const express = require('express');
const router = express.Router();
const { contactForm, contactBlogAuthForm } = require('../controllers/form');

const { runValidation } = require('../validators');
const { contactFormValidator } = require('../validators/form');

router.post('/contact', contactFormValidator, runValidation, contactForm);
router.post(
  '/contact-blog-author',
  contactFormValidator,
  runValidation,
  contactBlogAuthForm
);

module.exports = router;
