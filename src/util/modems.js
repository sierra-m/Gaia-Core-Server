
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import {query} from './pg';

class ModemValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ModemValidationError";
    }
}

const processCsvFile = (filepath) => {
    const content = fs.readFileSync(filepath);
    return parse(content);
};


const formatRecord = (record, index) => {
    const modemInfo = {};
    modemInfo.imei = parseInt(record[0]);
    if (isNaN(modemInfo.imei)) {
        throw new ModemValidationError(`IMEI incorrect for row index ${index}, must be a number`);
    }
    modemInfo.org = record[1].trim().replaceAll(" ", "-");
    modemInfo.name = record[2].trim().replaceAll(" ", "_");
    if (modemInfo.name === "") {
        throw new ModemValidationError(`Modem name cannot be blank for row index ${index}`);
    }
    return modemInfo;
}


const checkUniqueNames = (names) => {
    const uniq = names
        .map((name) => {
            return {
                count: 1,
                name: name
            };
        })
        .reduce((result, b) => {
            result[b.name] = (result[b.name] || 0) + b.count;

            return result;
        }, {});
    const duplicates = Object.keys(uniq).filter((a) => uniq[a] > 1);

    if (duplicates) {
        throw new ModemValidationError(`Duplicate modem names are not allowed, detected: ${duplicates}`);
    }
}


const storeModems = async (modems) => {
    await query(`DELETE * FROM public.modems`);
    for (let modem of modems) {
        await query(
            "INSERT INTO public.modems (imei, organization, name) VALUES ($1, $2, $3)",
            [modem.imei, modem.org, modem.name]
        );
    }
}


export default class ModemList {
    modems = new Map();

    loadModems (filepath) {
        try {
            // Pull csv as array of records
            const records = processCsvFile(filepath);
            const first = records[0];
            // Validate column names
            if (first[0].toLowerCase() !== 'imei' || first[1].toLowerCase() !== 'organization' || first[2].toLowerCase() !== 'modem name') {
                throw new ModemValidationError('First row must match [IMEI, Organization, Modem Name] format');
            }
            // Build array of formatted modem fields
            const formattedModems = records.map(formatRecord);
            // Ensure modem names are all unique
            const names = formattedModems.map((modem) => (modem.name));
            checkUniqueNames(names);
            // TODO: enable modem storage with database migration complete
            //await storeModems(modems);

            // Load modem objects into map for easy searching
            for (let modem of formattedModems) {
                this.modems.set(modem.imei, modem);
            }
            console.log(`Loaded modems from CSV`);
        } catch (e) {
            console.error(`Caught error while loading from CSV:\n${e}`);
            console.warn('Attempting to load modems from the database...')
            // TODO: load modems from database
            throw new Error('Not implemented');
        }
    }

    has (imei) {
        return this.modems.has(imei);
    }

    get (imei) {
        return this.modems.get(imei);
    }

    getByName (name) {
        for (let modem of this.modems) {
            if (modem.name === name) {
                return modem;
            }
        }
    }

    getRedactedSet (visibleDigits) {
        return [...this.modems.values()].map((modem) => ({
            partialImei: modem.imei.toString().slice(-visibleDigits),
            org: modem.org,
            name: modem.name
        }));
    }

    toString () {
        let out = [];
        for (let [key, value] of this.modems) {
            out.push(`imei ${key}: {org: ${value.org}, name: ${value.name}}\n`);
        }
        return out.join('\n');
    }
}