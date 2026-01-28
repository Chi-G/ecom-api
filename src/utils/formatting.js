exports.formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};
exports.slugify = (text) => {
    return text.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
};