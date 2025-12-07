const gulp = require('gulp')

const rollupEach = require('gulp-rollup-each')
const rollupCommon = require('@rollup/plugin-commonjs')
const { nodeResolve: rollupResolve } = require('@rollup/plugin-node-resolve')

const del = require('del')
const gulpIf = require('gulp-if')

const postcss = require('gulp-postcss')
const dartSass = require('sass')
const gulpSass = require('gulp-sass')
const autoprefixer = require('autoprefixer')
const concat = require('gulp-concat')
const cleanCSS = require('gulp-clean-css')

const imagemin = require('gulp-imagemin')
const mozjpeg = require('imagemin-mozjpeg')
const pngquant = require('imagemin-pngquant')

const plumber = require('gulp-plumber')

const terser = require('gulp-terser')

const zip = require('gulp-zip')

const sass = gulpSass(dartSass)

const paths = {
  scripts: {
    src: 'src/js/**/*.js',
    entry: 'src/js/*.js',
    dest: 'dist/js/'
  },
  styles: {
    src: 'src/css/**/*.scss',
    dest: 'dist/css/'
  },
  images: {
    src: 'src/img/**/*',
    dest: 'dist/img/'
  },
  copys: {
    src: ['_locales/**/*', 'background.js', 'manifest.json'],
    dest: 'dist/'
  },
  vendor: {
    src: ['src/vendor/*.js'],
    dest: 'dist/js/'
  },
  compress: {
    src: 'dist/**/*',
    dest: 'dist/'
  }
}

const config = {
  plumberConfig: {
    errorHandler: function (err) {
      console.log(err.toString())
      this.emit('end')
    }
  },
  env: {
    dev: process.env.NODE_ENV === 'development',
    prod: process.env.NODE_ENV === 'production'
  }
}

function scripts () {
  return gulp.src(paths.scripts.entry, { sourcemaps: config.env.dev })
    .pipe(plumber(config.plumberConfig))
    .pipe(rollupEach({
      isCache: true,
      plugins: [
        rollupCommon(),
        rollupResolve({
          browser: true
        })
      ]
    },
    {
      format: 'iife'
    }
    ))
    .pipe(gulpIf(config.env.prod, terser()))
    .pipe(gulp.dest(paths.scripts.dest, { sourcemaps: config.env.dev }))
}

function styles () {
  return gulp.src(paths.styles.src)
    .pipe(plumber(config.plumberConfig))
    .pipe(sass({
      precision: 3,
      includePaths: ['.']
    }))
    .pipe(postcss([
      autoprefixer()
    ]))
    .pipe(concat('style.css'))
    .pipe(gulpIf(config.env.prod, cleanCSS()))
    .pipe(gulp.dest(paths.styles.dest), { sourcemaps: config.env.dev })
}

function images () {
  return gulp.src(paths.images.src)
    .pipe(plumber(config.plumberConfig))
    .pipe(imagemin([
      pngquant(),
      mozjpeg(),
      imagemin.svgo()], {
      verbose: true
    }))
    .pipe(gulp.dest(paths.images.dest))
}

function copys () {
  return gulp.src(paths.copys.src, { base: '.' })
    .pipe(gulp.dest(paths.copys.dest))
}

function copyVendor () {
  return gulp.src(paths.vendor.src)
    .pipe(gulp.dest(paths.vendor.dest))
}

function clean () {
  return del(['dist'])
}

function watch () {
  gulp.watch(paths.copys.src, copys)
  gulp.watch(paths.scripts.src, scripts)
  gulp.watch(paths.styles.src, styles)
}

function compress () {
  return gulp.src(paths.compress.src)
    .pipe(zip('chrome.zip'))
    .pipe(gulp.dest(paths.compress.dest))
}

const build = gulp.parallel(scripts, styles, images, copys, copyVendor)
const serve = gulp.series(clean, build, watch)
const publish = gulp.series(clean, build, compress)

exports.build = build
exports.serve = serve
exports.publish = publish
exports.clean = clean
exports.compress = compress
