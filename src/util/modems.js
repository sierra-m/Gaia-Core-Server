
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import {query} from './pg';
import * as config from '../config'

class ModemValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ModemValidationError";
    }
}

class ModemLoadError extends Error {
    constructor(message) {
        super(message);
        this.name = "ModemLoadError";
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

    if (duplicates.length > 0) {
        throw new ModemValidationError(`Duplicate modem names are not allowed, detected: ${duplicates}`);
    }
}


const storeModems = async (modems) => {
    await query(`DELETE FROM public.modems`);
    for (let modem of modems) {
        await query(
            "INSERT INTO public.modems (imei, organization, name) VALUES ($1, $2, $3)",
            [modem.imei, modem.org, modem.name]
        );
    }
}

const loadModemsFromDb = async () => {
    const result = await query(`SELECT * FROM public.modems`);
    if (result.length < 1) {
        throw new ModemLoadError('No data loaded from database');
    }
    return result;
}


export default class ModemList {
    modems = new Map();

    async loadModems (filepath) {
        try {
            // Pull csv as array of records
            const records = processCsvFile(filepath);
            const first = records.shift();
            // Validate column names
            if (first[0].toLowerCase() !== 'imei' || first[1].toLowerCase() !== 'organization' || first[2].toLowerCase() !== 'modem name') {
                throw new ModemValidationError('First row must match [IMEI, Organization, Modem Name] format');
            }
            // Build array of formatted modem fields
            const formattedModems = records.map(formatRecord);
            // Ensure modem names are all unique
            const names = formattedModems.map((modem) => (modem.name));
            checkUniqueNames(names);
            // Note: called without 'await' as this class is sync, while pg is async. Should not
            // affect operations
            await storeModems(formattedModems);
            console.log(`Stored modem records in database`);

            // Load modem objects into map for easy searching
            for (let modem of formattedModems) {
                this.modems.set(modem.imei, modem);
            }
            console.log(`Loaded modems from CSV`);
        } catch (e) {
            console.error(`Caught error while loading from CSV:\n${e}`);
            console.warn('Attempting to load modems from the database...')
            const loaded = await loadModemsFromDb();
            // Load modem objects into map for easy searching
            for (let modem of loaded) {
                this.modems.set(modem.imei, {imei: modem.imei, org: modem.organization, name: modem.name});
            }
        }
    }

    has (imei) {
        return this.modems.has(imei);
    }

    get (imei) {
        return this.modems.get(imei);
    }

    getByName (name) {
        for (let modem of this.modems.values()) {
            if (modem.name === name) {
                return modem;
            }
        }
    }

    getRedacted (imei) {
        const modem = this.get(imei);
        return {
            partialImei: modem.imei.toString().slice(-config.EXPOSED_IMEI_DIGITS),
            org: modem.org,
            name: modem.name
        }
    }

    getRedactedSet () {
        return [...this.modems.keys()].map((imei) => this.getRedacted(imei));
    }

    toString () {
        let out = [];
        for (let [key, value] of this.modems) {
            out.push(`imei ${key}: {org: ${value.org}, name: ${value.name}}\n`);
        }
        return out.join('\n');
    }
}