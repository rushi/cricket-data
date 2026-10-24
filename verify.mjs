#!/usr/bin/env npx zx
/**
 * Sanity checks on a built cricket.db. Exits non-zero on the first
 * class of failure so CI never deploys a broken database.
 */
import { $, chalk } from 'zx/core';

$.verbose = false;

const DB = 'cricket.db';

const queryJson = async (query) => JSON.parse((await $`sqlite-utils query ${DB} ${query}`).stdout);

/** Each check is a query that must return zero rows. */
const CHECKS = {
    'foreign keys resolve': `pragma foreign_key_check`,
    'tables are populated': `
        select name from (
            select 'players' as name, count(*) as n from players
            union all select 'stats', count(*) from stats
            union all select 'teams', count(*) from teams
            union all select 'countries', count(*) from countries
            union all select 'formats', count(*) from formats
        ) where n = 0
    `,
    'derived stats columns are integers': `
        select playerId, classId from stats
        where typeof(bat_highScoreRuns) not in ('integer', 'null')
           or typeof(bowl_bestInningsWickets) not in ('integer', 'null')
           or typeof(bowl_bestInningsRuns) not in ('integer', 'null')
           or typeof(bowl_bestMatchWickets) not in ('integer', 'null')
           or typeof(bowl_bestMatchRuns) not in ('integer', 'null')
    `,
    'every high score was parsed': `select playerId from stats where bat_highScore is not null and bat_highScoreRuns is null`,
    'every best-figures value was parsed': `
        select playerId from stats
        where (bowl_bestInnings is not null and bowl_bestInningsWickets is null)
           or (bowl_bestMatch is not null and bowl_bestMatchWickets is null)
    `,
    'no blank strings in players': `
        select id from players
        where '' in (name, longName, fullName, slug, gender, dateOfBirth, battingStyles, bowlingStyles, playingRoles)
    `,
    'bowling styles are JSON arrays': `select id from players where bowlingStyles is not null and json_type(bowlingStyles) != 'array'`,
    'every stats row has a gender': `select playerId from stats where gender is null`,
    'format names carry no gender prefix': `select id from formats where name like 'Women%'`,
};

async function main() {
    const failures = [];
    for (const [name, query] of Object.entries(CHECKS)) {
        const rows = await queryJson(query);
        if (rows.length > 0) {
            failures.push(name);
            console.error(chalk.red(`FAIL ${name}: ${rows.length} rows, e.g. ${JSON.stringify(rows.slice(0, 3))}`));
            continue;
        }
        console.log(chalk.dim(`ok   ${name}`));
    }

    if (failures.length > 0) {
        throw new Error(`${failures.length} of ${Object.keys(CHECKS).length} checks failed`);
    }
    console.log(chalk.green(`All ${Object.keys(CHECKS).length} checks passed`));
}

main().catch((err) => {
    console.error(chalk.red(err.message));
    process.exit(1);
});
