/**
 * Validates that an ID is a positive integer within safe bounds.
 * @param {any} id - The value to validate as an ID
 * @returns {boolean} - True if the ID is valid
 */
export const validateId = (id) => {
    const numId = Number(id);
    return Number.isInteger(numId) && numId > 0 && numId <= Number.MAX_SAFE_INTEGER;
};
