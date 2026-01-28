const logger = {
    info: (message, meta = {}) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [INFO]: ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
    },

    error: (message, error = {}) => {
        const timestamp = new Date().toISOString();
        const errorDetails = error instanceof Error ? { message: error.message, stack: error.stack } : error;
        console.error(`[${timestamp}] [ERROR]: ${message}`, JSON.stringify(errorDetails));
    },

    warn: (message, meta = {}) => {
        const timestamp = new Date().toISOString();
        console.warn(`[${timestamp}] [WARN]: ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
    },

    debug: (message, meta = {}) => {
        if (process.env.NODE_ENV === 'development') {
            const timestamp = new Date().toISOString();
            console.debug(`[${timestamp}] [DEBUG]: ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
        }
    }
};

module.exports = logger;
