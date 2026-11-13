import ProgressionManager from '@gks/sdk/systems/ProgressionManager.js';

/**
 * SuperLompiLand progression. Extends the SDK shell (storage plumbing:
 * init/get/set/resetProgress); this subclass only sets the UNIQUE key prefix.
 */
export default class extends ProgressionManager {
    constructor() {
        super('super_lompi_land_');
    }
}
