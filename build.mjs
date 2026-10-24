#!/usr/bin/env npx zx
/**
 * Builds cricket.db from the CSVs in data/: loads, cleans, derives
 * sortable columns, adds lookup tables, foreign keys, views, full-text
 * search and indexes.
 */
import { rm } from 'node:fs/promises';
import { $, chalk } from 'zx/core';

$.verbose = false;

const DB = 'cricket.db';
const IMAGE_HOST = 'https://img1.hscicdn.com/image/upload/f_auto';

/** ESPNcricinfo batting and bowling style codes found in the player CSVs. */
const STYLES = [
    ['rhb', 'batting', 'Right-hand bat'],
    ['lhb', 'batting', 'Left-hand bat'],
    ['rf', 'bowling', 'Right-arm fast'],
    ['rfm', 'bowling', 'Right-arm fast-medium'],
    ['rmf', 'bowling', 'Right-arm medium-fast'],
    ['rm', 'bowling', 'Right-arm medium'],
    ['rsm', 'bowling', 'Right-arm slow-medium'],
    ['rs', 'bowling', 'Right-arm slow'],
    ['ob', 'bowling', 'Right-arm offbreak'],
    ['lb', 'bowling', 'Legbreak'],
    ['lbg', 'bowling', 'Legbreak googly'],
    ['rab', 'bowling', 'Right-arm bowler'],
    ['lf', 'bowling', 'Left-arm fast'],
    ['lfm', 'bowling', 'Left-arm fast-medium'],
    ['lmf', 'bowling', 'Left-arm medium-fast'],
    ['lm', 'bowling', 'Left-arm medium'],
    ['lsm', 'bowling', 'Left-arm slow-medium'],
    ['ls', 'bowling', 'Left-arm slow'],
    ['sla', 'bowling', 'Slow left-arm orthodox'],
    ['lws', 'bowling', 'Left-arm wrist-spin'],
    ['lab', 'bowling', 'Left-arm bowler'],
    ['s', 'bowling', 'Slow'],
].map(([code, kind, name]) => ({ code, kind, name }));

const sql = (query) => $`sqlite-utils query ${DB} ${query}`;

const queryJson = async (query) => JSON.parse((await sql(query)).stdout);

const insertCsv = (table, file, pks) => $`sqlite-utils insert ${DB} ${table} ${file} --csv ${pks.map((pk) => `--pk=${pk}`)}`;

/** CSV blanks arrive as '' in TEXT columns; store them as NULL so facets and filters treat them as missing. */
async function nullifyBlankText(table) {
    const columns = await queryJson(`select name from pragma_table_info('${table}') where type = 'TEXT'`);
    for (const { name } of columns) {
        await sql(`update ${table} set "${name}" = null where "${name}" = ''`);
    }
}

/** Splits an 'N/M' figures column into integer wickets and runs columns. */
async function splitFigures(source, prefix) {
    await $`sqlite-utils add-column ${DB} stats ${`${prefix}Wickets`} integer`;
    await $`sqlite-utils add-column ${DB} stats ${`${prefix}Runs`} integer`;
    await sql(`
        update stats set
            ${prefix}Wickets = cast(substr(${source}, 1, instr(${source}, '/') - 1) as integer),
            ${prefix}Runs = cast(substr(${source}, instr(${source}, '/') + 1) as integer)
        where ${source} is not null
    `);
}

async function load() {
    await insertCsv('countries', 'data/countries.csv', ['id']);
    // Men's and women's CSVs share a schema and ids never overlap, so they share tables (gender is a column)
    await insertCsv('players', 'data/players-men-international.csv', ['id']);
    await insertCsv('players', 'data/players-women-international.csv', ['id']);
    await insertCsv('teams', 'data/teams.csv', ['id']);
    await insertCsv('stats', 'data/stats-men-international.csv', ['playerId', 'classId']);
    await insertCsv('stats', 'data/stats-women-international.csv', ['playerId', 'classId']);
}

async function cleanPlayers() {
    await nullifyBlankText('players');

    await $({ input: JSON.stringify(STYLES) })`sqlite-utils insert ${DB} styles - --pk=code`;

    const unknownCodes = await queryJson(`
        with codes as (
            select battingStyles as code from players where battingStyles is not null
            union
            select j.value from players, json_each('["' || replace(bowlingStyles, '|', '","') || '"]') j
            where bowlingStyles is not null
        )
        select code from codes where code not in (select code from styles)
    `);
    if (unknownCodes.length > 0) {
        throw new Error(`Unmapped style codes, add them to STYLES: ${unknownCodes.map(({ code }) => code).join(', ')}`);
    }

    await sql(`update players set battingStyles = (select name from styles where code = players.battingStyles)`);

    // Bowling styles can be multi-valued ('rfm|lb'); a JSON array of labels lets Datasette facet each style
    await sql(`
        update players set bowlingStyles = (
            select json_group_array(name) from (
                select s.name from json_each('["' || replace(players.bowlingStyles, '|', '","') || '"]') j
                join styles s on s.code = j.value
                order by j.key
            )
        )
        where bowlingStyles is not null
    `);

    await $`sqlite-utils add-column ${DB} players hasStats integer`;
    await sql(`update players set hasStats = exists (select 1 from stats where stats.playerId = players.id)`);
}

async function cleanStats() {
    await $`sqlite-utils add-column ${DB} stats gender text`;
    await sql(`update stats set gender = (select gender from players where players.id = stats.playerId)`);

    // '-' placeholders mean "no value"
    for (const column of ['bat_highScore', 'bowl_bestInnings', 'bowl_bestMatch']) {
        await sql(`update stats set ${column} = null where ${column} = '-'`);
    }

    // Format names duplicate the gender column ("Women's ODIs")
    await sql(`update stats set format = replace(format, 'Women''s ', '')`);

    // High score is text like '26*'; split into sortable runs plus a not-out flag
    await $`sqlite-utils add-column ${DB} stats bat_highScoreRuns integer`;
    await $`sqlite-utils add-column ${DB} stats bat_highScoreNotOut integer`;
    await sql(`
        update stats set
            bat_highScoreRuns = cast(rtrim(bat_highScore, '*') as integer),
            bat_highScoreNotOut = bat_highScore like '%*'
        where bat_highScore is not null
    `);

    await splitFigures('bowl_bestInnings', 'bowl_bestInnings');
    await splitFigures('bowl_bestMatch', 'bowl_bestMatch');
}

async function cleanTeamsAndCountries() {
    await nullifyBlankText('teams');
    await nullifyBlankText('countries');

    // isCountry arrives as the text 'true'/'false'
    await $`sqlite-utils convert ${DB} teams isCountry ${'1 if value == "true" else 0'} --output-type integer`;
    await $`sqlite-utils transform ${DB} teams --type isCountry integer`;

    // Image paths are relative to the ESPNcricinfo image CDN
    for (const table of ['teams', 'countries']) {
        await sql(`update ${table} set imageUrl = '${IMAGE_HOST}' || imageUrl where imageUrl like '/%'`);
    }
}

async function addFormats() {
    const { stdout } = await sql(`select distinct classId as id, format as name, gender from stats order by id`);
    await $({ input: stdout })`sqlite-utils insert ${DB} formats - --pk=id`;
}

async function addRelations() {
    await $`sqlite-utils add-foreign-key ${DB} players countryId countries id`;
    await $`sqlite-utils add-foreign-key ${DB} teams countryId countries id`;
    await $`sqlite-utils add-foreign-key ${DB} stats playerId players id`;
    await $`sqlite-utils add-foreign-key ${DB} stats classId formats id`;

    await $`sqlite-utils create-index ${DB} stats format gender`;
    await $`sqlite-utils create-index ${DB} players countryId`;
    await $`sqlite-utils create-index ${DB} teams countryId`;

    await $`sqlite-utils enable-fts ${DB} players name longName fullName`;
    await $`sqlite-utils enable-fts ${DB} teams name longName`;
}

async function addViews() {
    await $`sqlite-utils create-view ${DB} player_stats ${`
        select s.*, c.name as country, p.dateOfBirth, p.battingStyles, p.bowlingStyles, p.playingRoles
        from stats s
        join players p on p.id = s.playerId
        left join countries c on c.id = p.countryId
    `}`;

    await $`sqlite-utils create-view ${DB} career_totals ${`
        select
            playerId, longName, gender, country,
            group_concat(format, ', ') as formats,
            sum(bat_matches) as matches,
            sum(bat_innings) as innings,
            sum(bat_runs) as runs,
            round(1.0 * sum(bat_runs) / nullif(sum(bat_innings) - sum(bat_notOuts), 0), 2) as battingAverage,
            max(bat_highScoreRuns) as highScore,
            sum(bat_hundreds) as hundreds,
            sum(bat_fifties) as fifties,
            sum(bat_catches) as catches,
            sum(bat_stumpings) as stumpings,
            sum(bowl_wickets) as wickets,
            round(1.0 * sum(bowl_runsConceded) / nullif(sum(bowl_wickets), 0), 2) as bowlingAverage,
            sum(bowl_fiveWickets) as fiveWicketHauls
        from player_stats
        group by playerId
    `}`;
}

async function main() {
    await rm(DB, { force: true });
    await load();
    await cleanStats();
    await cleanPlayers();
    await cleanTeamsAndCountries();
    await addFormats();
    await addRelations();
    await addViews();
    await $`sqlite-utils vacuum ${DB}`;
    console.log(chalk.green(`Built ${DB}`));
}

main().catch((err) => {
    console.error(chalk.red(err.message));
    process.exit(1);
});
