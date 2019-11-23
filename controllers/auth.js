// const mongoose = require('');
const User = require('../models/user');
const Blog = require('../models/blog');
const shortId = require('shortid');
const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const errorHandler = require('../helpers/dbErrorHandler');
const sgMail = require('@sendgrid/mail');
const _ = require('lodash');
const { OAuth2Client } = require('google-auth-library');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.preSignUp = (req, res) => {
  const { name, email, password } = req.body;
  User.findOne({ email: email.toLowerCase() }).exec((err, user) => {
    if (user) {
      return res.status(400).json({
        error: 'Email is taken',
      });
    }
    //generate a json web token
    const token = jwt.sign(
      { name, email, password },
      process.env.JWT_ACCOUNT_ACTIVATION,
      {
        expiresIn: '10m',
      }
    );

    // email
    const emailData = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Account activation link`,
      html: `
      <p>Please use the following link to activate your account:</p>
      <p>${process.env.CLIENT_URL}/auth/account/activate/${token}</p>
      <hr />
      <p>This email may contain sensitive information</p>
      <p>https://seoblog.com</p>
    `,
    };
    sgMail.send(emailData).then(sent => {
      return res.json({
        message: `Email has been sent to ${email}. Follow the instructions to activate your account`,
      });
    });
  });
};

exports.signUp = (req, res) => {
  const token = req.body.token;
  if (token) {
    jwt.verify(token, process.env.JWT_ACCOUNT_ACTIVATION, function(
      err,
      decoded
    ) {
      if (err) {
        return res.status(401).json({
          error: 'Expired link. Signup again',
        });
      }

      const { name, email, password } = jwt.decode(token);
      //generate a random id/username
      let username = shortId.generate();
      //profile is the profile url which based on username
      let profile = `${process.env.CLIENT_URL}/profile/${username}`;

      const user = new User({ name, email, password, profile, username });
      user.save((err, success) => {
        if (err) {
          return res.status(400).json({
            error: errorHandler(err),
          });
        }
        res.json({
          message: 'Signup success! Please signin',
        });
      });
    });
  } else {
    return res.json({
      message: 'Something went wrong. Try again',
    });
  }
};

exports.signIn = (req, res) => {
  const { email, password } = req.body;
  // check if user exists
  User.findOne({ email }).exec((err, user) => {
    if (err || !user) {
      return res.status(400).json({
        error: 'User that email does not exist, please sign up',
      });
    }
    //authenticate if user name and password match
    if (!user.authenticate(password)) {
      return res.status(400).json({
        error: 'Email and password do not match',
      });
    }
    //generate a json web token
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    res.cookie('token', token, { expiresIn: '1d' });
    const { _id, username, email, role, name } = user;
    return res.json({
      token,
      user: { _id, username, email, role, name },
    });
  });
};

exports.signOut = (req, res) => {
  res.clearCookie('token');
  res.json({
    message: 'Signout success',
  });
};

//expressJWT package to validate token and append user id to req
exports.requireSignin = expressJwt({
  secret: process.env.JWT_SECRET,
});

//get the user id appended from requireSignin middleware
exports.authMiddleware = (req, res, next) => {
  const authUserId = req.user._id;
  //find the user in DB
  User.findById({ _id: authUserId }).exec((err, user) => {
    if (err || !user) {
      return res.status(400).json({
        error: 'User not found',
      });
    }
    //add the user available to req.profile
    req.profile = user;
    //execute next middleware
    next();
  });
};

//same as above, but extra check for admin role
exports.adminMiddleware = (req, res, next) => {
  const adminUserId = req.user._id;
  User.findById({ _id: adminUserId }).exec((err, user) => {
    if (err || !user) {
      return res.status(400).json({
        error: 'User not found',
      });
    }
    if (user.role !== 1) {
      return res.status(400).json({
        error: 'Admin resource. Access denied',
      });
    }
    req.profile = user;
    next();
  });
};

exports.canUpdateDeleteBlog = (req, res, next) => {
  const slug = req.params.slug.toLowerCase();
  Blog.findOne({ slug }).exec((err, data) => {
    if (err) {
      return res.status(400).json({
        error: errorHandler(err),
      });
    }
    console.log(data);
    let authorizedUser =
      data.postedBy._id.toString() === req.profile._id.toString();
    if (!authorizedUser) {
      return res.status(400).json({
        error: 'You are not authorized',
      });
    }
    next();
  });
};

exports.forgotPassword = (req, res) => {
  const { email } = req.body;
  User.findOne({ email }).exec((err, user) => {
    if (err || !user) {
      return res.status(401).json({
        error: 'User not found',
      });
    }
    const token = jwt.sign({ _id: user._id }, process.env.JWT_RESET_PASSWORD, {
      expiresIn: '10m',
    });

    // email
    const emailData = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Password reset link`,
      html: `
      <p>Please use the follwoing link to reset your password:</p>
      <p>${process.env.CLIENT_URL}/auth/password/reset/${token}</p>
      <hr />
      <p>This email may contain sensetive information</p>
      <p>https://seoblog.com</p>
    `,
    };

    // populate the db with user reset password link
    return user.updateOne({ resetPasswordLink: token }, (err, success) => {
      if (err) {
        return res.status(400).json({
          error: errorHandler(err),
        });
      }
      sgMail
        .send(emailData)
        .then(sent => {
          return res.json({
            message: `Email has been sent to ${email}. Follow the instructions to reset your password. Link expires
in 10 mins`,
          });
        })
        .catch(err => console.log(err));
    });
  });
};

exports.resetPassword = (req, res) => {
  const { resetPasswordLink, newPassword } = req.body;

  if (resetPasswordLink) {
    jwt.verify(resetPasswordLink, process.env.JWT_RESET_PASSWORD, function(
      err,
      decoded
    ) {
      if (err) {
        return res.status(401).json({
          error: 'Expired link. Try again',
        });
      }
      User.findOne({ resetPasswordLink }, (err, user) => {
        if (err || !user) {
          return res.status(401).json({
            error: 'Something went wrong. Try again',
          });
        }
        const updatedFields = {
          password: newPassword,
          resetPasswordLink: '',
        };

        user = _.extend(user, updatedFields);

        user.save((err, results) => {
          if (err) {
            return res.status(401).json({
              error: errorHandler(err),
            });
          }
          res.json({
            message: 'Great! Now you can login with your new password',
          });
        });
      });
    });
  }
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
exports.googleLogin = (req, res) => {
  const idToken = req.body.tokenId;
  client
    .verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID })
    .then(response => {
      console.log(response);
      const { email_verified, name, email, jti } = response.payload;
      if (email_verified) {
        User.findOne({ email }).exec((err, user) => {
          if (user) {
            // console.log(user);
            const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
              expiresIn: '1d',
            });
            res.cookie('token', token, { expiresIn: '1d' });
            return res.json({
              token,
              user: {
                _id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                username: user.username,
              },
            });
          } else {
            let username = shortId.generate();
            let profile = `${process.env.CLIENT_URL}/profile/${username}`;
            let password = jti;
            user = new User({ name, email, profile, username, password });
            user.save((err, data) => {
              if (err) {
                return res.status(400).json({
                  error: errorHandler(err),
                });
              }

              const token = jwt.sign(
                { _id: user._id },
                process.env.JWT_SECRET,
                {
                  expiresIn: '1d',
                }
              );
              res.cookie('token', token, { expiresIn: '1d' });
              return res.json({
                token,
                user: {
                  _id: data._id,
                  email: data.email,
                  name: data.name,
                  role: data.role,
                  username: data.username,
                },
              });
            });
          }
        });
      } else {
        return res.status(400).json({
          error: 'Google login failed. Try again',
        });
      }
    });
};
