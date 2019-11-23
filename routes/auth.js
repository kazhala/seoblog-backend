const express = require('express');
const router = express.Router();
const {
  signUp,
  signIn,
  signOut,
  requireSignin,
  forgotPassword,
  resetPassword,
  preSignUp,
  googleLogin,
} = require('../controllers/auth');

//express validators
const { runValidation } = require('../validators');
const {
  userSignupValidator,
  userSignInValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} = require('../validators/auth');

router.post('/pre-signup', userSignupValidator, runValidation, preSignUp);
router.post('/signup', signUp);
router.post('/signin', userSignInValidator, runValidation, signIn);
router.get('/signout', signOut);

router.put(
  '/forgot-password',
  forgotPasswordValidator,
  runValidation,
  forgotPassword
);
router.put(
  '/reset-password',
  resetPasswordValidator,
  runValidation,
  resetPassword
);

router.post('/google-login', googleLogin);

module.exports = router;
