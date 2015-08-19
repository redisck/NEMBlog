var _       = require('lodash');
var marked = require('marked');
var helpers = require('./_helpers');
var settings = require('../../config/settings');
var util = require('../lib/util');
var models  = require('../models');


module.exports = {
  auth_admin: function(req, res, next){
    if(req.session.admin){
      return next();
    }else{
      var cookie = req.cookies[settings.auth_cookie_name];
      if(!cookie)
        return res.redirect('/admin/login');

      var auth_token = util.decrypt(cookie, settings.session_secret);
      var auth = auth_token.split('\t');
      var admin_name = auth[0];

      models.admin.findOne({where:{name:admin_name}}).then(function(result){
        if(result){
          req.session.admin = result;
          return next();
        }else{
          return res.redirect('/admin/login')
        }
      });
    }
  },
  postIndex: function(req, res){
    models.post.findAll().then(function(results){
        res.render('admin/post_index', {layout: false, post_list: results});
    });
  },
  postWrite: function(req, res){
    if(req.method == "GET"){
        res.render('admin/post_write', {layout: false});
    }else if(req.method == "POST"){
        var post = _.pick(req.body, 'title', 'slug','content','keywords','description','tags');
        post.content_html = marked(post.content);
        post.status = 1;
        models.post.create(post).then(function(result){
            res.redirect('/admin/post/edit/' + result.id);
        });
    }
  },
  postEdit: function(req, res){
    if(req.method == "GET"){
        var id = req.params.id;
        models.post.findById(id).then(function(result){
            res.render('admin/post_edit', {layout: false, post: result});
        }).catch(function(error) {
            res.redirect('/admin/post');
        });
    }else if(req.method == "POST"){
        var post = _.pick(req.body, 'title', 'slug','content','keywords','description','tags');
        post.content_html = marked(post.content);
        post.status = 1;
        models.post.update(post,{where:{id: req.body.id}}).then(function(){
            res.redirect('/admin/post/edit/' + req.body.id);
        });
    }
  },
  postDelete: function(req, res){
    if(req.method == "GET"){
        var id = req.params.id;
        models.post.destroy({where:{id: id}}).then(function(){
            res.redirect('/admin/post');
        }).catch(function(error) {
            res.redirect('/admin/post');
        });
    }
  },
  login: function(req, res){
    if(req.method == "GET"){
        res.render('admin/login', {layout: false});
    }else if(req.method == "POST"){
        var name = req.body.name.trim();
        var pass = req.body.pass.trim();
        if(name == '' || pass == ''){
            res.render('admin/login', {layout: false,error: '账号或密码为空！'});
            return;
        }

        //check username and password
        models.admin.findOne({where:{name:name}}).then(function(result){
            if(result){
              pass = util.md5(pass);
              if(result.password !=pass){
                //to be safe,show username or password error
                res.render('admin/login',{layout: false,error: '账号或密码错误！'});
                return;
              }
              //store session cookie
              _do_session(result, res);
              res.redirect('/admin');
            }else{
              return res.redirect('/admin/login')
            }
        });
    }
  },
  logout: function(req, res, next){
    req.session.destroy();
    res.clearCookie(settings.auth_cookie_name,{path: '/'});
    res.redirect('/');
  },
  index: function(req, res){
    res.render('admin/index', {layout: false});
  },
  install: function(req, res, next){

    models.admin.count().then(function(c) {
      if(c > 0){
        /*已经初始化*/
        if(req.query['msg'] == "success")
          res.render('admin/install', {layout:false, msg: 'success'});
        else
          res.render('admin/install', {layout:false, msg: true});
      }else{
        if(req.method == "GET"){
            res.render('admin/install', {layout: false});
          }else if(req.method == "POST"){
            //将用户输入的账号密码插入到admin表中
            var params = _.pick(req.body, 'name', 'password');
            params.password = util.md5(params.password);
            //console.dir(params);
            models.admin.create(params).then(function(){
                res.redirect('/admin/install?msg=success');
            });
          }
      }
    });

  }
  
};


/**
 * private function
 */
function _do_session(admin, res){
    var auth_token = util.encrypt(admin.name + '\t' + admin.password, settings.session_secret);
    res.cookie(settings.auth_cookie_name, auth_token, {path: '/',maxAge: 1000*60*60*24*7});
}