// @ts-nocheck
import { NextFunction } from 'express';
import mongoose from 'mongoose';
import { toJSON } from '../toJSON';
import paginate from '../paginate/paginate';

const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    comment: {
      type: String,
      required: [true, 'Comment is required'],
    },
    likes: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Posts',
    },
    replies: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'CommentReply',
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
commentSchema.plugin(toJSON);
commentSchema.plugin(paginate);



const Comment = mongoose.model('Comment', commentSchema);

export default Comment;
