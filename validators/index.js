const { validationResult } = require('express-validator');

//get the error message and return the first one as json response
// middleware that would run before the controllers
exports.runValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ error: errors.array()[0].msg });
    }
    next();
};
