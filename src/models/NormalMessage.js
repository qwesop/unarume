const mongoose = require('mongoose');

const msglist = new mongoose.Schema({
    inputmsg: {
        type: String,
        requried: true,
    },
    response: {
        type: String,
        required: true,
    },
    userId: {
        type: String,
        required: true,
    }
});

module.exports = mongoose.model('NormalMessage', msglist)