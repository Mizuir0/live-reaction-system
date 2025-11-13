import { v4 as uuidv4 } from 'uuid';

const USER_ID_KEY = 'live_reaction_user_id';

/**
 * ユーザーIDを取得または生成する
 * localStorageに保存されていればそれを返し、なければ新規生成して保存する
 */
export const getUserId = (): string => {
  let userId = localStorage.getItem(USER_ID_KEY);
  
  if (!userId) {
    userId = `user-${uuidv4()}`;
    localStorage.setItem(USER_ID_KEY, userId);
    console.log('新しいユーザーIDを生成しました:', userId);
  } else {
    console.log('既存のユーザーIDを使用します:', userId);
  }
  
  return userId;
};

/**
 * ユーザーIDをクリアする（デバッグ用）
 */
export const clearUserId = (): void => {
  localStorage.removeItem(USER_ID_KEY);
  console.log('ユーザーIDをクリアしました');
};