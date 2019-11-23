const Blog = require('../models/blog');
const Category = require('../models/category');
const User = require('../models/user');
const Tag = require('../models/tag');
const formidable = require('formidable');
const slugify = require('slugify');
const stripHtml = require('string-strip-html');
const _ = require('lodash');
const { errorHandler } = require('../helpers/dbErrorHandler');
const fs = require('fs');
const { smartTrim } = require('../helpers/blog');

exports.create = (req, res) => {
  let form = new formidable.IncomingForm();
  //keep the form file extensions .jpg .png....etc
  form.keepExtensions = true;
  form.parse(req, (err, fields, files) => {
    if (err) {
      return res.status(400).json({
        error: 'Image could not upload..',
      });
    }
    const { title, body, categories, tags } = fields;

    if (!title || !title.length) {
      return res.status(400).json({
        error: 'Title is required',
      });
    }

    if (!body || body.length < 200) {
      return res.status(400).json({
        error: 'Content is too short',
      });
    }

    if (!categories || categories.length === 0) {
      return res.status(400).json({
        error: 'At lease one category is required',
      });
    }

    if (!tags || tags.length === 0) {
      return res.status(400).json({
        error: 'At lease one tag is required',
      });
    }

    //new blog document
    let blog = new Blog();
    blog.title = title;
    blog.body = body;
    blog.slug = slugify(title).toLowerCase();
    blog.mtitle = `${title} | ${process.env.APP_NAME}`;
    blog.mdesc = stripHtml(body.substring(0, 160));
    blog.postedBy = req.profile._id;
    blog.excerpt = smartTrim(body, 320, ' ', '...');

    //categories and tags
    let arrayOfCategories = categories && categories.split(',');
    let arrayOfTags = tags && tags.split(',');

    //handle files
    if (files.photo) {
      if (files.photo.size > 10000000) {
        return res.status(400).json({
          error: 'Image is too big! Should be less than 1mb in size',
        });
      }
      blog.photo.data = fs.readFileSync(files.photo.path);
      blog.photo.contentType = files.photo.type;
    }

    blog.save((err, result) => {
      console.log(err);
      if (err) {
        return res.status(400).json({
          error: errorHandler(err),
        });
      }
      // res.json(result);
      Blog.findByIdAndUpdate(
        result._id,
        { $push: { categories: arrayOfCategories } },
        { new: true }
      ).exec((err, result) => {
        if (err) {
          return res.status(400).json({
            error: errorHandler(err),
          });
        } else {
          Blog.findByIdAndUpdate(
            result._id,
            { $push: { tags: arrayOfTags } },
            { new: true }
          ).exec((err, result) => {
            if (err) {
              return res.status(400).json({
                error: errorHandler(err),
              });
            } else {
              res.json(result);
            }
          });
        }
      });
    });
  });
};

exports.list = (req, res) => {
  Blog.find({})
    .populate('tags', '_id name slug')
    .populate('categories', '_id name slug')
    .populate('postedBy', '_id name username')
    .select(
      '_id title slug excerpt categories tags postedBy createdAt updatedAt'
    )
    .exec((err, data) => {
      if (err) {
        return res.status(400).json({
          error: errorHandler(err),
        });
      }
      res.json(data);
    });
};

//get all the categories, tags, blogs
exports.listAllBlogsCategoriesTags = (req, res) => {
  //get the limit and skip
  let limit = req.body.limit ? parseInt(req.body.limit) : 10;
  let skip = req.body.skip ? parseInt(req.body.skip) : 0;
  let blogs;
  let categories;
  let tags;

  //find all blogs and populate the categories and tags
  Blog.find({})
    .populate('categories', '_id name slug')
    .populate('tags', '_id name slug')
    .populate('postedBy', '_id name username profile')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select(
      '_id title slug excerpt categories tags postedBy createdAt updatedAt'
    )
    .exec((err, data) => {
      if (err) {
        return res.status(400).json({
          error: errorHandler(err),
        });
      }
      //all the blog
      blogs = data;

      //get all the categories
      Category.find({}).exec((err, c) => {
        if (err) {
          return res.status(400).json({
            error: errorHandler(err),
          });
        }
        //all the categories
        categories = c;

        Tag.find({}).exec((err, t) => {
          if (err) {
            return res.status(400).json({
              error: errorHandler(err),
            });
          }

          //all the tags
          tags = t;
          //return everything as json
          res.json({ blogs, categories, tags, size: blogs.length });
        });
      });
    });
};

exports.read = (req, res) => {
  const slug = req.params.slug.toLowerCase();
  Blog.findOne({ slug })
    .populate('tags', '_id name slug')
    .populate('categories', '_id name slug')
    .populate('postedBy', '_id name username')
    .select(
      '_id title body slug mtitle mdesc categories tags postedBy createdAt updatedAt'
    )
    .exec((err, data) => {
      if (err) {
        return res.status(400).json({
          error: 'Blog not found',
        });
      }
      res.json(data);
    });
};

exports.remove = (req, res) => {
  const slug = req.params.slug.toLowerCase();
  Blog.findOneAndRemove({ slug }).exec((err, data) => {
    if (err) {
      return res.status(400).json({
        error: errorHandler(err),
      });
    }
    res.json({
      message: 'Blog deleted successfully',
    });
  });
};

exports.update = (req, res) => {
  const slug = req.params.slug.toLowerCase();

  Blog.findOne({ slug }).exec((err, oldBlog) => {
    if (err) {
      return res.status(400).json({
        error: 'Something went wrong',
      });
    }

    let form = new formidable.IncomingForm();
    //keep the form file extensions .jpg .png....etc
    form.keepExtensions = true;

    form.parse(req, (err, fields, files) => {
      if (err) {
        return res.status(400).json({
          error: 'Image could not upload..',
        });
      }

      //keep the old slug
      let slugBeforeMerge = oldBlog.slug;
      oldBlog = _.merge(oldBlog, fields);
      oldBlog.slug = slugBeforeMerge;

      const { body, desc, categories, tags } = fields;

      if (body) {
        oldBlog.excerpt = smartTrim(body, 320, ' ', '...');
        oldBlog.desc = stripHtml(body.substring(0, 160));
      }

      if (categories) {
        oldBlog.categories = categories.split(',');
      }

      if (tags) {
        oldBlog.tags = tags.split(',');
      }

      //handle files
      if (files.photo) {
        if (files.photo.size > 10000000) {
          return res.status(400).json({
            error: 'Image is too big! Should be less than 1mb in size',
          });
        }
        oldBlog.photo.data = fs.readFileSync(files.photo.path);
        oldBlog.photo.contentType = files.photo.type;
      }

      oldBlog.save((err, result) => {
        console.log(err);
        if (err) {
          return res.status(400).json({
            error: errorHandler(err),
          });
        }
        result.photo = undefined;
        res.json(result);
      });
    });
  });
};

exports.photo = (req, res) => {
  const slug = req.params.slug.toLowerCase();
  Blog.findOne({ slug })
    .select('photo')
    .exec((err, blog) => {
      if (err || !blog) {
        return res.status(400).json({
          error: 'Image could not be loaded',
        });
      }
      res.set('Content-Type', blog.photo.contentType);
      return res.send(blog.photo.data);
    });
};

exports.listRelated = (req, res) => {
  const limit = req.body.limit ? parseInt(req.body.limit) : 3;

  const { _id, categories } = req.body.blog;

  Blog.find({ _id: { $ne: _id }, categories: { $in: categories } })
    .limit(limit)
    .populate('postedBy', '_id name username profile')
    .select('title slug excerpt postedBy createdAt updatedAt')
    .exec((err, blogs) => {
      if (err) {
        return res.status(400).json({
          error: 'Blogs not found',
        });
      }
      res.json(blogs);
    });
};

exports.listSearch = (req, res) => {
  const { search } = req.query;
  if (search) {
    Blog.find(
      {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { body: { $regex: search, $options: 'i' } },
        ],
      },
      (err, blogs) => {
        if (err) {
          return res.status(400).json({
            error: errorHandler(err),
          });
        }
        res.json(blogs);
      }
    ).select('-photo -body');
  }
};

exports.listByUser = (req, res) => {
  User.findOne({ username: req.params.username }).exec((err, user) => {
    if (err) {
      return res.status(400).json({
        error: errorHandler(err),
      });
    }

    let userId = user._id;
    Blog.find({ postedBy: userId })
      .populate('categories', '_id name slug')
      .populate('tags', '_id name slug')
      .populate('postedBy', '_id name username')
      .select('_id title slug postedBy createdAt updatedAt')
      .exec((err, data) => {
        if (err) {
          return res.status(400).json({
            error: errorHandler(err),
          });
        }
        res.json(data);
      });
  });
};
