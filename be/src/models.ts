import type { ObjectId } from "mongodb";

export type AccountDoc = {
  _id: ObjectId;
  displayName: string;
  email: string;
  avatar: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AccountPublic = {
  id: string;
  displayName: string;
  email: string;
  avatar: string;
  createdAt: Date;
  updatedAt: Date;
};

export function toAccountPublic(doc: AccountDoc): AccountPublic {
  return {
    id: doc._id.toHexString(),
    displayName: doc.displayName,
    email: doc.email,
    avatar: doc.avatar,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

