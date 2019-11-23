/**
 * The user schema, which defines the fields in mongoDB
 */
const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
	{
		username: {
			type: String,
			trim: true,
			required: true,
			max: 32,
			unique: true,
			index: true,
			lowercase: true
		},
		name: {
			type: String,
			trim: true,
			required: true,
			max: 32
		},
		email: {
			type: String,
			trim: true,
			required: true,
			unique: true,
			lowercase: true
		},
		profile: {
			type: String,
			required: true
		},
		hashed_password: {
			type: String,
			required: true
		},
		salt: String,
		about: {
			type: String
		},
		role: {
			type: Number,
			default: 0
		},
		photo: {
			data: Buffer,
			contentType: String
		},
		resetPasswordLink: {
			data: String,
			default: ''
		}
	},
	{ timestamps: true }
);

//virtual field for hashing password
userSchema
	.virtual('password')
	//set method for virtual field
	.set(function(password) {
		//create a temporary variable _password
		this._password = password;
		//generate salt for hashing the password
		this.salt = this.makeSalt();
		//encrypt password
		this.hashed_password = this.encryptPassword(password);
		// console.log(this.hashed_password);
	})
	//get method for virtual field
	.get(function() {
		return this._password;
	});

userSchema.methods = {
	authenticate: function(plainPassword) {
		//hash the in coming password and compare with the hashed_password
		return this.encryptPassword(plainPassword) === this.hashed_password;
	},
	encryptPassword: function(password) {
		if (password === null) return '';
		//use crypto methods to hash the password
		try {
			return crypto
				.createHmac('sha1', this.salt)
				.update(password)
				.digest('hex');
		} catch (err) {
			return '';
		}
	},
	makeSalt: function() {
		//use random numbers to create a salt
		return Math.round(new Date().valueOf() * Math.random()) + '';
	}
};

module.exports = mongoose.model('User', userSchema);
