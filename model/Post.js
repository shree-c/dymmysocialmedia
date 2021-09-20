const postsCollection = require('../db').db('complexapp').collection('posts');
const { ObjectId } = require('mongodb');
const User = require('./User');
let Post = function (data, _id, requestedPostId) {
    //contains body and title
    this.data = data;
    this.errors = [];
    //for marking each post
    this._id = _id;
    this.requestedPostId = requestedPostId;
};
Post.prototype.cleanUp = function () {
    if (typeof (this.data.title) != 'string') {
        this.data.title = '';
    }
    if (typeof (this.data.body) != 'string') {
        this.data.body = '';
    }
    this.data = {
        body: this.data.body.trim(),
        title: this.data.title.trim(),
        createdDate: new Date(),
        author: new ObjectId(this._id),
    };
};
Post.prototype.validate = function () {
    if (this.data.title == '') {
        this.errors.push('the title cannot be empty.');
    }
    if (this.data.body == '') {
        this.errors.push('you must provide post content.');
    }
};
Post.prototype.create = async function () {
    this.cleanUp();
    this.validate();
    try {
        if (!this.errors.length) {
            await postsCollection.insertOne(this.data);
        } else {
            //this is temperory
            throw new Error(this.errors);
        }
    } catch (e) {
        console.log(e);
        throw new Error('sorry try again later');
    }
};
//preparing a common aggrigate function for single post screen and profile screen
Post.commonAggrigate = async function (uniqArrayOps, visitorId) {
    //so we need username for displaying author of a post
    //but that is stored in users collection
    //Aggregation operations process data records and return computed results. Aggregation operations group values from multiple documents together, and can perform a variety of operations on the grouped data to return a single result.
    //it takes an array of operations
    //clean up author property
    //return await postsCollection.findOne({ _id: new ObjectId(postid) });
    //this is a common function similar thing applies for getting array of posts

    const concatinatedOps = uniqArrayOps.concat([
        {
            //look in users collection for document with matching field as author
            $lookup: {
                from: 'cusers',
                localField: 'author',
                foreignField: '_id',
                as: 'authorDocument'
            }
        },
        // to project the required data
        {
            $project: {
                _id: 1,
                title: 1,
                body: 1,
                createdDate: 1,
                authorId: "$author",
                author: {
                    $arrayElemAt: ["$authorDocument", 0]
                }
            }
        }
    ])
    let posts = await postsCollection.aggregate(concatinatedOps).toArray();
    posts = posts.map(function (post) {
        post.isVisitorOwner = post.authorId.equals(visitorId);
        post.author = {
            username: post.author.username,
            avatar: new User(post.author, true).avatar
        }
        return post;
    })
    return posts;
}
Post.findSingleById =  function (postid, visitorId) {
    //finding the post by id
    if (typeof (postid) == 'string' && ObjectId.isValid(postid)) {
        return this.commonAggrigate([{
                $match: {
                    _id: new ObjectId(postid),
                }
            }], visitorId);
    } else
        throw new Error('not a valid id')
}
//pulling in posts for single profile screen
Post.findByAuthorId = function (authorId) {
    return this.commonAggrigate([
        {$match: {
            author: authorId
        }},
        {$sort: {createdDate: -1}}
    ])
}
//actually updating post details called from update
Post.prototype.actuallyUpdate = function () {
    return new Promise(async (resolve, reject)=>{
        this.cleanUp();
        this.validate();
        if (!this.errors.length) {
            await 
            postsCollection.findOneAndUpdate({_id: new ObjectId(this.requestedPostId)}, {$set: {title: this.data.title, body: this.data.body}})
            resolve('success');
        } else {
            resolve('failure')
        }
    })
}
//updating the post
Post.prototype.update = function () {
    console.log('debug: from update post')
    return new Promise(async (resolve, reject)=>{
        try {
           let post = await Post.findSingleById(this.requestedPostId, this._id);
           console.log(post)
           if (post[0].isVisitorOwner) {
               //actually update db
               let status = await this.actuallyUpdate();
               resolve(status);
           }
           this.errors.push('you do not have permission to edit this post')
           reject('failure');
        } catch (error) {
            reject();
        }
    })
}
module.exports = Post;