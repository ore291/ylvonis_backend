// @ts-nocheck
import { fileDelete, fileUpload } from './../utils/fileUpload';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import ChatRoom from './chat.model';
import ChatMessage from './chatmessage.model';
import mongoose from 'mongoose';

export const deleteMedia = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id;

  await fileDelete(id);

  res.status(200).json({ status: 'success' });
});

export const uploadMedia = catchAsync(async (req: Request, res: Response) => {
  const media = req?.file;

  let fileUrl;
  let fileId;

  if (media) {
    try {
      const audioPath = await fileUpload(media);

      fileId = audioPath.public_id;
      fileUrl = audioPath.secure_url;

      return res.status(201).json({
        status: 'success',
        fileUrl: fileUrl,
        fileId: fileId,
      });
    } catch (error) {
      console.log(error);
    }
  }
});

export const initiateChat = catchAsync(async (req: Request, res: Response) => {
  const { userIds } = req.body;
  const chatInitiator = req.user.id;
  const allUserIds = [...userIds, chatInitiator];

  const fileData = {
    post_file: '',
    post_file_id: '',
    type: 'text',
  };
  const chatRoom = await ChatRoom.initiateChat(allUserIds, chatInitiator);
  await ChatMessage.createPostInChatRoom(chatRoom.chatRoomId, '', fileData, chatInitiator);
  return res.status(200).json({ success: true, chatRoom });
});

export const postMessage = catchAsync(async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const messagePayload = {
      messageText: req.body.messageText,
    };
    const fileData = req.body.fileData;

    const currentLoggedUser = req.user.id;
    const post = await ChatMessage.createPostInChatRoom(roomId, messagePayload, fileData, currentLoggedUser);

    global.io.to(roomId).emit('new message', { message: post });
    return res.status(200).json({ success: true, post });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, error: error });
  }
});

export const getChatLengths = catchAsync(async (req: Request, res: Response) => {
  const rooms = await ChatRoom.getChatRoomsByUserId(req.user.id);

  const chatRoomIds = rooms.map((room) => room._id);

  // const results = await ChatMessage.find( { readByRecipients: { $ne: req.user.id }  , chatRoomId: { $in: chatRoomIds } }).lean()

  // results = [...results].group(({ chatRoomId }) => chatRoomId)
  const currentLoggedUser = req.user.id;
  const results = await ChatMessage.aggregate(
    [
      {
        $match: {
          readByRecipients: { $ne: new mongoose.Types.ObjectId(currentLoggedUser)},
          chatRoomId: { $in: chatRoomIds },
        },
      },

      {
        $group: {
          _id: '$chatRoomId',
          myCount: { $sum: 1 },
          message: { $count: {} },
        },
      },
      {
        $count: "chats",
      },

      { $unwind: '$chats' }
    ],
    function (err, results) {
      if (err) throw err;
      return results;
    }
  );

  return res.status(200).json(results[0]);
});

export const getContacts = catchAsync(async (req: Request, res: Response) => {
  try {
    const currentLoggedUser = req.user.id;
    const options = {
      page: parseInt(req.query.page) || 0,
      limit: parseInt(req.query.limit) || 10,
    };
    const rooms = await ChatRoom.getChatRoomsByUserId(currentLoggedUser);

    const roomIds = rooms.map((room) => room._id);

    const recentConversation = await ChatMessage.getRecentConversation(roomIds, options, currentLoggedUser);

    const conversations = recentConversation.map((conversation) => {
      const otherUser = conversation.roomInfo.find((e) => e._id != currentLoggedUser);

      return { ...conversation, otherUser };
    });
    return res.status(200).json(conversations);
  } catch (error) {
    return res.status(500).json({ success: false, error: error });
  }
});

export const getChatRoomById = catchAsync(async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const room = await ChatRoom.findOne({ _id: roomId }).populate({
      path: 'userIds',
      select: 'id _id username profile_pic firstname lastname location',
    });
    if (!room) {
      return res.status(400).json({
        success: false,
        message: 'No room exists for this id',
      });
    }

    const otherUser = room.userIds.find((e) => e._id != req.user.id);

    return res.status(200).json({ room, otherUser });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, error: error });
  }
});

export const getMessagesByChatId = catchAsync(async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const room = await ChatRoom.getChatRoomByRoomId(roomId);
    if (!room) {
      return res.status(400).json({
        success: false,
        message: 'No room exists for this id',
      });
    }

    const options = {
      page: parseInt(req.query.page) || 0,
      limit: parseInt(req.query.limit) || 30,
    };

    const result = await ChatMessage.updateMany(
      {
        chatRoomId: roomId,
        readByRecipients: { $ne: req.user.id },
      },
      { $push: { readByRecipients: req.user.id } }
    );

    const conversation = await ChatMessage.find({ chatRoomId: roomId }).sort({ createdAt: 1 }).limit(50).populate({
      path: 'postedByUser',
      select: 'id _id username profile_pic firstname lastname location',
    });
    return res.status(200).json(conversation);
  } catch (error) {
    return res.status(500).json({ success: false, error });
  }
});

export const markConversationReadByRoomId = catchAsync(async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const room = await ChatRoomModel.getChatRoomByRoomId(roomId);
    if (!room) {
      return res.status(400).json({
        success: false,
        message: 'No room exists for this id',
      });
    }

    const currentLoggedUser = req.userId;
    const result = await ChatMessageModel.markMessageRead(roomId, currentLoggedUser);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, error });
  }
});
