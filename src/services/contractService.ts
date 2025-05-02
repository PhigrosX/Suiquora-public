import { useCallback, useState } from "react";
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { useSuiService } from "../context/SuiServiceContext";
import { constructFilePath, uploadImage } from "./SupabaseService";
import { useCurrentAccount } from "@mysten/dapp-kit";

const PACKAGE_ID: string = import.meta.env.VITE_CONTRACT_PACKAGE;
const MODULE_NAME = "suiquora";
const QUESTION_INFORMATION: string = import.meta.env
  .VITE_CONTRACT_QUESTIONS_INFORMATION;

console.log = function () {};

// Interface for question data
export interface QuestionData {
  id: string; //UID on Sui Blockchain
  asker: string;
  content: string;
  images?: string[];
  answerers: string[];
  answers: AnswerData[];
  bountyAmount: number;
  answered: boolean;
  bestAnswer?: AnswerData;
  createTime: number;
  endTime: number;
}

// Interface for answer data
export interface AnswerData {
  id: string; //UID on Sui Blockchain
  questionId?: string; // ID of the parent question
  answerer: string;
  answerContent: string;
  images?: string[];
  extraAnswerers: string[];
  extraContent: CommentData[];
  createTime?: number; // Timestamp when answer was created
  upvotes?: number; // Number of upvotes
  downvotes?: number; // Number of downvotes
}

// Interface for comment data
export interface CommentData {
  id: string; //UID on Sui Blockchain
  answerer: string;
  answerContent: string;
  content?: string; // Alias for answerContent
  images?: string[];
  createTime?: number; // Timestamp when comment was created
}

interface ContractHookResult<T> {
  isPending: boolean;
  error: Error | null;
  transactionId?: string;
  transactionResult?: T;
}

interface AskQuestionHook extends ContractHookResult<string> {
  askQuestion: (
    content: string,
    bountyAmount: number,
    images?: File[],
    expiryDays?: number,
  ) => Promise<string>;
}

interface AnswerQuestionHook extends ContractHookResult<string> {
  answerQuestion: (
    questionId: string,
    content: string,
    images?: File[],
  ) => Promise<string>;
}

interface ChooseBestAnswerHook extends ContractHookResult<string> {
  chooseBestAnswer: (
    questionId: string,
    answererAddress: string,
  ) => Promise<string>;
}

interface HandleExpiredQuestionHook extends ContractHookResult<any> {
  handleExpiredQuestion: (questionId: string) => Promise<any>;
}

interface AddCommentHook extends ContractHookResult<string> {
  addComment: (
    questionId: string,
    answererAddress: string,
    content: string,
    images?: File[],
  ) => Promise<string>;
}

// 在接口部分添加UpdateAnswerHook定义
interface UpdateAnswerHook extends ContractHookResult<string> {
  updateAnswer: (
    questionId: string,
    newContent: string,
    newImages?: File[],
  ) => Promise<string>;
}

// 在接口部分添加 EditCommentHook 定义
interface EditCommentHook extends ContractHookResult<string> {
  editComment: (
    questionId: string,
    answererToComment: string,
    newContent: string,
    newImages?: File[],
  ) => Promise<string>;
}

// React hooks for use in components
//asking a question
export function useAskQuestion(): AskQuestionHook {
  const { suiClient, signAndExecute } = useSuiService();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [transactionId, setTransactionId] = useState<string>();
  const account = useCurrentAccount();

  const askQuestion = async (
    content: string,
    bountyAmount: number,
    images?: File[],
    expiryDays?: number, // Now we'll actually use this parameter
  ): Promise<string> => {
    // Validate inputs
    if (!content) {
      throw new Error("Invalid content: must be a non-empty string");
    }
    if (bountyAmount <= 0) {
      throw new Error("Invalid bounty amount: must be greater than 0");
    }
    if (expiryDays !== undefined && (expiryDays < 1 || expiryDays > 30)) {
      throw new Error("Invalid expiry days: must be between 1 and 30 days");
    }

    setIsPending(true);
    setError(null);

    const METHOD: string = import.meta.env.VITE_CONTRACT_ASK_QUESTION;

    try {
      const txb = new Transaction();
      const updated_content = Array.from(new TextEncoder().encode(content));
      //here just to save test coins during testing, actually should be bountyAmount * 10^9 as the reward
      const [coin] = txb.splitCoins(txb.gas, [bountyAmount]);

      let images_vector: number[][] = [];
      let images_paths: string[] = [];
      if (images && images.length > 0) {
        images_vector = images.map((image, i) => {
          images_paths.push(constructFilePath(image, account!.address));

          return Array.from(new TextEncoder().encode(images_paths[i]));
        });
      }

      // Calculate custom expiry time in milliseconds (days * 24 hours * 60 min * 60 sec * 1000 ms)
      // If not provided, default to 15 days
      const expiryTimeMs = (expiryDays || 15) * 24 * 60 * 60 * 1000;

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::${METHOD}`,
        arguments: [
          txb.pure.vector("u8", updated_content),
          txb.pure.u64(bountyAmount),
          coin,
          txb.object.clock(),
          txb.object.option({
            type: "vector<vector<u8>>",
            value: txb.pure.vector("vector<u8>", images_vector),
          }),
          txb.object(QUESTION_INFORMATION),
          txb.pure.u64(expiryTimeMs),
        ],
      });

      return new Promise((resolve, reject) => {
        signAndExecute(
          { transaction: txb },
          {
            onSuccess: async (txResult: any) => {
              try {
                setIsPending(true);
                const _result = await suiClient.waitForTransaction({
                  digest: txResult.digest,
                  options: {
                    showEffects: true,
                    showEvents: true,
                    showObjectChanges: true,
                  },
                });

                if (_result.errors) {
                  const errorMsg = `transaction failed: ${_result.errors}`;
                  setError(new Error(errorMsg));
                  reject(new Error(errorMsg));
                } else {
                  //upload to supabase bucket
                  if (images && images.length > 0) {
                    try {
                      console.log("Starting image upload to Supabase...");

                      const uploadPromises = images.map(async (image, i) => {
                        const filePath = images_paths[i];
                        await uploadImage(image, filePath);
                      });

                      await Promise.all(uploadPromises);
                      console.log("Images uploaded successfully");
                    } catch (uploadError) {
                      console.error(
                        "Failed to upload images to bucket:",
                        uploadError,
                      );
                      setError(
                        uploadError instanceof Error
                          ? uploadError
                          : new Error("Failed to upload images"),
                      );
                    }
                  }

                  setTransactionId(txResult.digest);
                  resolve(txResult.digest);
                }
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error
                    : new Error(" unknown error in transaction"),
                );
                reject(error);
              } finally {
                setIsPending(false);
              }
            },
            onError: (error: any) => {
              setError(
                error instanceof Error
                  ? error
                  : new Error("transaction failed"),
              );
              setIsPending(false);
              reject(error);
            },
          },
        );
      });
    } catch (err) {
      setIsPending(false);
      const error = err instanceof Error ? err : new Error("unknown error");
      setError(error);
      throw error;
    }
  };

  return { askQuestion, isPending, error, transactionId };
}

// Answering a question
export function useAnswerQuestion(): AnswerQuestionHook {
  const { suiClient, signAndExecute } = useSuiService();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [transactionId, setTransactionId] = useState<string>();
  const account = useCurrentAccount();

  const answerQuestion = async (
    questionId: string,
    content: string,
    images?: File[],
  ): Promise<string> => {
    // Validate input parameters
    if (!questionId) {
      throw new Error("Invalid questionId: must be a non-empty string");
    }
    if (!content) {
      throw new Error("Invalid content: must be a non-empty string");
    }

    setIsPending(true);
    setError(null);

    const METHOD: string = import.meta.env.VITE_CONTRACT_ANSWER_QUESTION;

    try {
      const txb = new Transaction();
      // Safely convert content to UTF-8 encoded byte array
      let contentBytes: number[] = [];
      try {
        contentBytes = Array.from(new TextEncoder().encode(content));
        // Verify encoding and decoding is correct
        const decodedContent = new TextDecoder().decode(
          new Uint8Array(contentBytes),
        );
        const isDecodedCorrectly = decodedContent === content;
        if (!isDecodedCorrectly) {
          console.warn(
            "Warning: Decoded content does not match original content, encoding issues may exist",
          );
        }
      } catch (encodeError) {
        console.error("Error occurred during content encoding:", encodeError);
        throw new Error(
          `Failed to encode answer content: ${encodeError instanceof Error ? encodeError.message : "Unknown error"}`,
        );
      }

      let images_vector: number[][] = [];
      let images_paths: string[] = [];
      if (images && images.length > 0) {
        images_vector = images.map((image, i) => {
          images_paths.push(constructFilePath(image, account!.address));
          return Array.from(new TextEncoder().encode(images_paths[i]));
        });
      }

      // Parameters order:
      // 1. Question ID (UID)
      // 2. Answer content (vector<u8>)
      // 3. Image data option (Option<vector<vector<u8>>>)
      // 4. Global information object (QuestionInformation)
      // 5. System clock (Clock)
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::${METHOD}`,
        arguments: [
          txb.object(questionId),
          txb.pure.vector("u8", contentBytes),
          txb.object.option({
            type: "vector<vector<u8>>",
            value: txb.pure.vector("vector<u8>", images_vector),
          }),
          txb.object(QUESTION_INFORMATION),
          txb.object.clock(),
        ],
      });

      return new Promise((resolve, reject) => {
        signAndExecute(
          { transaction: txb },
          {
            onSuccess: async (txResult: any) => {
              try {
                setIsPending(true);
                const _result = await suiClient.waitForTransaction({
                  digest: txResult.digest,
                  options: {
                    showEffects: true,
                    showEvents: true,
                    showObjectChanges: true,
                  },
                });
                if (_result.errors) {
                  const errorMsg = `transaction failed: ${_result.errors}`;
                  setError(new Error(errorMsg));
                  reject(new Error(errorMsg));
                } else {
                  //upload to supabase bucket
                  if (images && images.length > 0) {
                    try {
                      console.log("Starting image upload to Supabase...");
                      const uploadPromises = images.map(async (image, i) => {
                        const filePath = images_paths[i];
                        await uploadImage(image, filePath);
                      });
                      await Promise.all(uploadPromises);
                      console.log("Images uploaded successfully");
                    } catch (uploadError) {
                      console.error(
                        "Failed to upload images to bucket:",
                        uploadError,
                      );
                      setError(
                        uploadError instanceof Error
                          ? uploadError
                          : new Error("Failed to upload images"),
                      );
                    }
                  }

                  setTransactionId(txResult.digest);
                  resolve(txResult.digest);
                }
              } catch (error) {
                console.error(`处理交易时出错:`, error);
                setError(
                  error instanceof Error
                    ? error
                    : new Error("unknown error in transaction"),
                );
                reject(error);
              } finally {
                setIsPending(false);
              }
            },
            onError: (error: any) => {
              console.error(`执行交易时出错:`, error);
              setError(
                error instanceof Error
                  ? error
                  : new Error("transaction failed"),
              );
              setIsPending(false);
              reject(error);
            },
          },
        );
      });
    } catch (err) {
      setIsPending(false);
      const error = err instanceof Error ? err : new Error("unknown error");
      setError(error);
      throw error;
    }
  };

  return { answerQuestion, isPending, error, transactionId };
}

// Choose the best answer
export function useChooseBestAnswer(): ChooseBestAnswerHook {
  const { suiClient, signAndExecute } = useSuiService();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [transactionId, setTransactionId] = useState<string>();

  const chooseBestAnswer = async (
    questionId: string,
    answererAddress: string,
  ): Promise<string> => {
    // Validate input parameters
    if (!questionId) {
      throw new Error("Invalid questionId: must be a non-empty string");
    }
    if (!answererAddress) {
      throw new Error("Invalid answererAddress: must be a non-empty string");
    }

    setIsPending(true);
    setError(null);

    const METHOD: string = import.meta.env.VITE_CONTRACT_CHOOSE_BEST_ANSWER;

    try {
      const txb = new Transaction();

      // Parameters order:
      // 1. Question ID (UID) - Question object ID
      // 2. Answerer's address (address) - Answerer's address
      // 3. System clock (Clock) - System clock object
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::${METHOD}`,
        arguments: [
          txb.object(questionId),
          txb.pure.address(answererAddress),
          txb.object.clock(),
        ],
      });

      return new Promise((resolve, reject) => {
        signAndExecute(
          { transaction: txb },
          {
            onSuccess: async (txResult: any) => {
              try {
                setIsPending(true);
                const _result = await suiClient.waitForTransaction({
                  digest: txResult.digest,
                  options: {
                    showEffects: true,
                    showEvents: true,
                    showObjectChanges: true,
                  },
                });
                if (_result.errors) {
                  const errorMsg = `transaction failed: ${_result.errors}`;
                  console.error(errorMsg);
                  setError(new Error(errorMsg));
                  reject(new Error(errorMsg));
                } else {
                  console.log(
                    `Best answer successfully chosen for question ${questionId}`,
                  );
                  setTransactionId(txResult.digest);
                  resolve(txResult.digest);
                }
              } catch (error) {
                console.error(`Error processing transaction:`, error);
                setError(
                  error instanceof Error
                    ? error
                    : new Error("unknown error in transaction"),
                );
                reject(error);
              } finally {
                setIsPending(false);
              }
            },
            onError: (error: any) => {
              console.error(`Error executing transaction:`, error);
              setError(
                error instanceof Error
                  ? error
                  : new Error("transaction failed"),
              );
              setIsPending(false);
              reject(error);
            },
          },
        );
      });
    } catch (err) {
      setIsPending(false);
      const error = err instanceof Error ? err : new Error("unknown error");
      setError(error);
      throw error;
    }
  };

  return { chooseBestAnswer, isPending, error, transactionId };
}

// Handle expired question
export function useHandleExpiredQuestion(): HandleExpiredQuestionHook {
  const { suiClient, signAndExecute } = useSuiService();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [transactionId, setTransactionId] = useState<string>();

  const handleExpiredQuestion = async (questionId: string): Promise<any> => {
    // Validate input parameters
    if (!questionId) {
      throw new Error("Invalid questionId: must be a non-empty string");
    }

    setIsPending(true);
    setError(null);

    const METHOD: string = import.meta.env
      .VITE_CONTRACT_HANDLE_EXPIRED_QUESTION;

    try {
      const txb = new Transaction();

      // Parameters order:
      // 1. Question ID (UID) - Question object ID
      // 2. System clock (Clock) - System clock object
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::${METHOD}`,
        arguments: [txb.object(questionId), txb.object.clock()],
      });

      return new Promise((resolve, reject) => {
        signAndExecute(
          { transaction: txb },
          {
            onSuccess: async (txResult: any) => {
              try {
                setIsPending(true);
                const _result = await suiClient.waitForTransaction({
                  digest: txResult.digest,
                  options: {
                    showEffects: true,
                    showEvents: true,
                    showObjectChanges: true,
                  },
                });
                if (_result.errors) {
                  const errorMsg = `transaction failed: ${_result.errors}`;
                  console.error(errorMsg);
                  setError(new Error(errorMsg));
                  reject(new Error(errorMsg));
                } else {
                  console.log(
                    `Expired question ${questionId} handled successfully`,
                  );
                  setTransactionId(txResult.digest);
                  resolve(txResult.digest);
                }
              } catch (error) {
                console.error(`Error processing transaction:`, error);
                setError(
                  error instanceof Error
                    ? error
                    : new Error("unknown error in transaction"),
                );
                reject(error);
              } finally {
                setIsPending(false);
              }
            },
            onError: (error: any) => {
              console.error(`Error executing transaction:`, error);
              setError(
                error instanceof Error
                  ? error
                  : new Error("transaction failed"),
              );
              setIsPending(false);
              reject(error);
            },
          },
        );
      });
    } catch (err) {
      setIsPending(false);
      const error = err instanceof Error ? err : new Error("unknown error");
      setError(error);
      throw error;
    }
  };

  return { handleExpiredQuestion, isPending, error, transactionId };
}

// Add comment to an answer
export function useAddComment(): AddCommentHook {
  const { suiClient, signAndExecute } = useSuiService();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [transactionId, setTransactionId] = useState<string>();
  const account = useCurrentAccount();

  const addComment = async (
    questionId: string,
    answererAddress: string,
    content: string,
    images?: File[],
  ): Promise<string> => {
    // Validate input parameters
    if (!questionId) {
      throw new Error("Invalid questionId: must be a non-empty string");
    }
    if (!answererAddress) {
      throw new Error("Invalid answererAddress: must be a non-empty string");
    }
    if (!content) {
      throw new Error("Invalid content: must be a non-empty string");
    }

    setIsPending(true);
    setError(null);

    const METHOD: string = import.meta.env.VITE_CONTRACT_ADD_COMMENT_TO_ANSWER;

    try {
      const txb = new Transaction();
      const updated_content = Array.from(new TextEncoder().encode(content));

      let images_vector: number[][] = [];
      let images_paths: string[] = [];
      if (images && images.length > 0) {
        images_vector = images.map((image, i) => {
          images_paths.push(constructFilePath(image, account!.address));
          return Array.from(new TextEncoder().encode(images_paths[i]));
        });
      }

      // Parameters order:
      // 1. Global information object (QuestionInformation)
      // 2. Question ID (UID) - Question object ID
      // 3. Answerer's address (address) - Answerer's address
      // 4. Comment content (vector<u8>)
      // 5. Image data option (Option<vector<vector<u8>>>)
      // 6. System clock (Clock)

      console.log("updated_content", updated_content);

      console.log(updated_content);

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::${METHOD}`,
        arguments: [
          txb.object(QUESTION_INFORMATION),
          txb.object(questionId),
          txb.pure.address(answererAddress),
          txb.pure.vector("u8", updated_content),
          txb.object.option({
            type: "vector<vector<u8>>",
            value: txb.pure.vector("vector<u8>", images_vector),
          }),
          txb.object.clock(),
        ],
      });

      return new Promise((resolve, reject) => {
        signAndExecute(
          { transaction: txb },
          {
            onSuccess: async (txResult: any) => {
              try {
                setIsPending(true);
                const _result = await suiClient.waitForTransaction({
                  digest: txResult.digest,
                  options: {
                    showEffects: true,
                    showEvents: true,
                    showObjectChanges: true,
                  },
                });
                if (_result.errors) {
                  const errorMsg = `transaction failed: ${_result.errors}`;
                  console.error(errorMsg);
                  setError(new Error(errorMsg));
                  reject(new Error(errorMsg));
                } else {
                  //upload to supabase bucket
                  if (images && images.length > 0) {
                    try {
                      console.log("Starting image upload to Supabase...");
                      const uploadPromises = images.map(async (image, i) => {
                        const filePath = images_paths[i];
                        await uploadImage(image, filePath);
                      });
                      await Promise.all(uploadPromises);
                      console.log("Images uploaded successfully");
                    } catch (uploadError) {
                      console.error(
                        "Failed to upload images to bucket:",
                        uploadError,
                      );
                      setError(
                        uploadError instanceof Error
                          ? uploadError
                          : new Error("Failed to upload images"),
                      );
                    }
                  }

                  setTransactionId(txResult.digest);
                  resolve(txResult.digest);
                }
              } catch (error) {
                console.error(`Error processing transaction:`, error);
                setError(
                  error instanceof Error
                    ? error
                    : new Error("unknown error in transaction"),
                );
                reject(error);
              } finally {
                setIsPending(false);
              }
            },
            onError: (error: any) => {
              console.error(`Error executing transaction:`, error);
              setError(
                error instanceof Error
                  ? error
                  : new Error("transaction failed"),
              );
              setIsPending(false);
              reject(error);
            },
          },
        );
      });
    } catch (err) {
      setIsPending(false);
      const error = err instanceof Error ? err : new Error("unknown error");
      setError(error);
      throw error;
    }
  };

  return { addComment, isPending, error, transactionId };
}

// Update an answer
export function useUpdateAnswer(): UpdateAnswerHook {
  const { suiClient, signAndExecute } = useSuiService();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [transactionId, setTransactionId] = useState<string>();
  const account = useCurrentAccount();

  const updateAnswer = async (
    questionId: string,
    newContent: string,
    newImages?: File[],
  ): Promise<string> => {
    // Validate input parameters
    if (!questionId) {
      throw new Error("Invalid questionId: must be a non-empty string");
    }
    if (!newContent) {
      throw new Error("Invalid content: must be a non-empty string");
    }

    setIsPending(true);
    setError(null);

    const METHOD: string = import.meta.env.VITE_CONTRACT_EDIT_ANSWER;

    try {
      const txb = new Transaction();

      // Safely convert content to UTF-8 encoded byte array
      let contentBytes: number[] = [];
      try {
        contentBytes = Array.from(new TextEncoder().encode(newContent));

        // Verify encoding and decoding is correct
        const decodedContent = new TextDecoder().decode(
          new Uint8Array(contentBytes),
        );
        const isDecodedCorrectly = decodedContent === newContent;

        if (!isDecodedCorrectly) {
          console.warn(
            "Warning: Decoded content does not match original content, encoding issues may exist",
          );
        }
      } catch (encodeError) {
        console.error("Error occurred during content encoding:", encodeError);
        throw new Error(
          `Failed to encode answer content: ${encodeError instanceof Error ? encodeError.message : "Unknown error"}`,
        );
      }

      let images_vector: number[][] = [];
      let images_paths: string[] = [];
      if (newImages && newImages.length > 0) {
        images_vector = newImages.map((newImage, i) => {
          images_paths.push(constructFilePath(newImage, account!.address));
          return Array.from(new TextEncoder().encode(images_paths[i]));
        });
      }

      // Parameters order:
      // 1. Question ID (UID) - Question object ID
      // 2. New answer content (vector<u8>)
      // 3. New images option (Option<vector<vector<u8>>>)
      // 4. System clock (Clock)
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::${METHOD}`,
        arguments: [
          txb.object(questionId),
          txb.pure.vector("u8", contentBytes),
          txb.object.option({
            type: "vector<vector<u8>>",
            value: txb.pure.vector("vector<u8>", images_vector),
          }),
          txb.object.clock(),
        ],
      });

      return new Promise((resolve, reject) => {
        signAndExecute(
          { transaction: txb },
          {
            onSuccess: async (txResult: any) => {
              try {
                setIsPending(true);
                const _result = await suiClient.waitForTransaction({
                  digest: txResult.digest,
                  options: {
                    showEffects: true,
                    showEvents: true,
                    showObjectChanges: true,
                  },
                });
                if (_result.errors) {
                  const errorMsg = `transaction failed: ${_result.errors}`;
                  console.error(errorMsg);
                  setError(new Error(errorMsg));
                  reject(new Error(errorMsg));
                } else {
                  //upload to supabase bucket
                  if (newImages && newImages.length > 0) {
                    try {
                      console.log("Starting image upload to Supabase...");

                      const uploadPromises = newImages.map(
                        async (newImage, i) => {
                          const filePath = images_paths[i];
                          await uploadImage(newImage, filePath);
                        },
                      );

                      await Promise.all(uploadPromises);
                      console.log("Images uploaded successfully");
                    } catch (uploadError) {
                      console.error(
                        "Failed to upload images to bucket:",
                        uploadError,
                      );
                      setError(
                        uploadError instanceof Error
                          ? uploadError
                          : new Error("Failed to upload images"),
                      );
                    }
                  }

                  setTransactionId(txResult.digest);
                  resolve(txResult.digest);
                }
              } catch (error) {
                console.error(`Error processing transaction:`, error);
                setError(
                  error instanceof Error
                    ? error
                    : new Error("unknown error in transaction"),
                );
                reject(error);
              } finally {
                setIsPending(false);
              }
            },
            onError: (error: any) => {
              console.error(`Error executing transaction:`, error);
              setError(
                error instanceof Error
                  ? error
                  : new Error("transaction failed"),
              );
              setIsPending(false);
              reject(error);
            },
          },
        );
      });
    } catch (err) {
      setIsPending(false);
      const error = err instanceof Error ? err : new Error("unknown error");
      setError(error);
      throw error;
    }
  };

  return { updateAnswer, isPending, error, transactionId };
}

// 在其他 hook 函数之后，添加编辑评论的 hook
export function useEditComment(): EditCommentHook {
  const { suiClient, signAndExecute } = useSuiService();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [transactionId, setTransactionId] = useState<string>();
  const account = useCurrentAccount();

  const editComment = async (
    questionId: string,
    answererToComment: string,
    newContent: string,
    newImages?: File[],
  ): Promise<string> => {
    // Validate input parameters
    if (!questionId) {
      throw new Error("Invalid questionId: must be a non-empty string");
    }
    if (!answererToComment) {
      throw new Error("Invalid answererToComment: must be a non-empty string");
    }
    if (!newContent) {
      throw new Error("Invalid content: must be a non-empty string");
    }

    setIsPending(true);
    setError(null);

    const METHOD: string = import.meta.env.VITE_CONTRACT_EDIT_COMMENT;

    try {
      const txb = new Transaction();
      const updated_content = Array.from(new TextEncoder().encode(newContent));

      let images_vector: number[][] = [];
      let images_paths: string[] = [];
      if (newImages && newImages.length > 0) {
        images_vector = newImages.map((image, i) => {
          images_paths.push(constructFilePath(image, account!.address));
          return Array.from(new TextEncoder().encode(images_paths[i]));
        });
      }

      // Parameters order based on edit_comment function:
      // 1. Question ID (UID) - Question object ID
      // 2. Answerer to comment (address) - Answerer's address whose answer is being commented on
      // 3. New comment content (vector<u8>)
      // 4. New images option (Option<vector<vector<u8>>>)
      // 5. System clock (Clock)

      console.log("Editing comment for question:", questionId);
      console.log("Answerer being commented:", answererToComment);
      console.log("New content:", newContent);

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::${METHOD}`,
        arguments: [
          txb.object(questionId),
          txb.pure.address(answererToComment),
          txb.pure.vector("u8", updated_content),
          txb.object.option({
            type: "vector<vector<u8>>",
            value:
              newImages && newImages.length > 0
                ? txb.pure.vector("vector<u8>", images_vector)
                : null,
          }),
          txb.object.clock(),
        ],
      });

      return new Promise((resolve, reject) => {
        signAndExecute(
          { transaction: txb },
          {
            onSuccess: async (txResult: any) => {
              try {
                setIsPending(true);
                const _result = await suiClient.waitForTransaction({
                  digest: txResult.digest,
                  options: {
                    showEffects: true,
                    showEvents: true,
                    showObjectChanges: true,
                  },
                });
                if (_result.errors) {
                  const errorMsg = `transaction failed: ${_result.errors}`;
                  console.error(errorMsg);
                  setError(new Error(errorMsg));
                  reject(new Error(errorMsg));
                } else {
                  //upload to supabase bucket
                  if (newImages && newImages.length > 0) {
                    try {
                      console.log("Starting image upload to Supabase...");
                      const uploadPromises = newImages.map(async (image, i) => {
                        const filePath = images_paths[i];
                        await uploadImage(image, filePath);
                      });
                      await Promise.all(uploadPromises);
                      console.log("Images uploaded successfully");
                    } catch (uploadError) {
                      console.error(
                        "Failed to upload images to bucket:",
                        uploadError,
                      );
                      setError(
                        uploadError instanceof Error
                          ? uploadError
                          : new Error("Failed to upload images"),
                      );
                    }
                  }

                  setTransactionId(txResult.digest);
                  resolve(txResult.digest);
                }
              } catch (error) {
                console.error(`Error processing transaction:`, error);
                setError(
                  error instanceof Error
                    ? error
                    : new Error("unknown error in transaction"),
                );
                reject(error);
              } finally {
                setIsPending(false);
              }
            },
            onError: (error: any) => {
              console.error(`Error executing transaction:`, error);
              setError(
                error instanceof Error
                  ? error
                  : new Error("transaction failed"),
              );
              setIsPending(false);
              reject(error);
            },
          },
        );
      });
    } catch (err) {
      setIsPending(false);
      const error = err instanceof Error ? err : new Error("unknown error");
      setError(error);
      throw error;
    }
  };

  return { editComment, isPending, error, transactionId };
}

// Non-hook utility functions that take SuiClient as a parameter
// Function to fetch all questions
export async function fetchAllQuestions(
  suiClient: SuiClient,
): Promise<QuestionData[]> {
  try {
    // Add backoff mechanism to avoid frequent requests causing 429 errors
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        console.log(
          `Attempting to fetch questions (attempt ${retries + 1}/${maxRetries})`,
        );

        // Get question list information object
        const questionsInfo = await suiClient.getObject({
          id: QUESTION_INFORMATION,
          options: { showContent: true },
        });

        console.log("====== Question information object data structure ======");
        // Print full structure for analysis
        if (questionsInfo.data?.content?.dataType === "moveObject") {
          const infoFields = (questionsInfo.data.content as any).fields;
          console.log(
            "Global information object fields:",
            Object.keys(infoFields),
          );

          // Analyze relationship between askers and question_information
          if (
            Array.isArray(infoFields.askers) &&
            Array.isArray(infoFields.question_information)
          ) {
            console.log(
              `askers number: ${infoFields.askers.length}, question_information array number: ${infoFields.question_information.length}`,
            );
            infoFields.question_information.forEach(
              (qArray: any, index: number) => {
                const asker =
                  infoFields.askers.length > index
                    ? infoFields.askers[index]
                    : "unknown";
                console.log(
                  `asker[${index}]: ${asker}, corresponding question number: ${Array.isArray(qArray) ? qArray.length : 0}`,
                );
              },
            );
          }

          // Store mapping between answerers and answers_information
          let answererToAnswerMap = new Map<string, string[]>();

          // Analyze relationship between answerers and answers_information
          if (
            Array.isArray(infoFields.answerers) &&
            Array.isArray(infoFields.answers_information)
          ) {
            console.log(
              `answerers number: ${infoFields.answerers.length}, answers_information array number: ${infoFields.answers_information.length}`,
            );
            infoFields.answers_information.forEach(
              (aArray: any, index: number) => {
                const answerer =
                  infoFields.answerers.length > index
                    ? infoFields.answerers[index]
                    : "unknown";
                console.log(
                  `answerer[${index}]: ${answerer}, corresponding answer number: ${Array.isArray(aArray) ? aArray.length : 0}`,
                );

                // Store answer IDs for each answerer
                if (Array.isArray(aArray) && answerer !== "unknown") {
                  answererToAnswerMap.set(answerer, aArray);
                }
              },
            );
          }

          console.log("Creating mapping between answerers and answer IDs:");
          answererToAnswerMap.forEach((answerIds, answerer) => {
            console.log(
              `Answerer ${answerer} has answer IDs: ${answerIds.join(", ")}`,
            );
          });

          // Save this mapping for later use
          (console as any)._debugAnswererMap = answererToAnswerMap;
        }

        // Check if data is valid
        if (
          !questionsInfo.data?.content ||
          questionsInfo.data.content.dataType !== "moveObject"
        ) {
          console.warn(
            "Failed to fetch questions information, returning empty array",
          );
          return [];
        }

        // Get all question IDs from question information object
        const moveObject = questionsInfo.data.content;
        if (moveObject.dataType !== "moveObject") {
          console.warn(
            "Invalid data type for questions information, returning empty array",
          );
          return [];
        }

        const fields = moveObject.fields as any;
        // Modify: Correctly understand and handle the index relationship between askers and question_information
        let questionIds: string[] = [];
        if (
          fields.question_information &&
          Array.isArray(fields.question_information)
        ) {
          console.log(
            "Question information data structure:",
            JSON.stringify(fields.question_information),
          );
          console.log("Question askers data:", JSON.stringify(fields.askers));

          // Iterate through each question_information array and add to questionIds
          fields.question_information.forEach(
            (idArray: string[], index: number) => {
              if (Array.isArray(idArray)) {
                // Record each array's question asker (if exists)
                const asker =
                  fields.askers && fields.askers.length > index
                    ? fields.askers[index]
                    : "unknown";
                console.log(
                  `The ${index}th array has ${idArray.length} questions, corresponding asker: ${asker}`,
                );

                // Add all question IDs to the merged array
                questionIds = [...questionIds, ...idArray];
              }
            },
          );

          console.log(`Total found ${questionIds.length} question IDs`);
        }

        if (!questionIds || questionIds.length === 0) {
          console.log(
            "No questions found on blockchain, returning empty array",
          );
          return [];
        }

        console.log(
          `Fetched ${questionIds.length} question IDs from blockchain, now retrieving details`,
        );

        // Use all question IDs to get all questions
        const questions = await suiClient.multiGetObjects({
          ids: questionIds,
          options: { showContent: true },
        });

        // Parse and return question data
        const parsedQuestions = questions
          .filter((q) => q.data?.content?.dataType === "moveObject")
          .map((q) => {
            try {
              const moveObject = q.data!.content!;
              if (moveObject.dataType !== "moveObject") {
                console.warn(
                  `Invalid data type for question ${q.data?.objectId}`,
                );
                return null;
              }

              const fields = moveObject.fields as any;

              // Debug resolved questions answer count
              if (fields.answered === true) {
                console.log(`Resolved question ${q.data!.objectId} data:`);
                console.log(
                  `- Answer number: ${Array.isArray(fields.answers) ? fields.answers.length : 0}`,
                );
                console.log(
                  `- answerers array: ${Array.isArray(fields.answerers) ? fields.answerers.length : 0} answerers`,
                );
                console.log(
                  `- Is there a best answer: ${fields.best_answer ? "Yes" : "No"}`,
                );

                // Check best answer in detail
                if (fields.best_answer) {
                  const bestAnswerFields =
                    fields.best_answer.fields || fields.best_answer;
                  const bestAnswerId = bestAnswerFields.id?.id || "unknown-id";
                  console.log(`- 最佳答案ID: ${bestAnswerId}`);
                  console.log(
                    `- 最佳答案回答者: ${bestAnswerFields.answerer || "未知"}`,
                  );

                  // 检查最佳答案是否也在answers数组中
                  let bestAnswerAlsoInAnswers = false;
                  if (Array.isArray(fields.answers)) {
                    for (let i = 0; i < fields.answers.length; i++) {
                      const answer = fields.answers[i];
                      const answerFields = answer.fields || answer;
                      const answerId = answerFields.id?.id || answer.id;
                      if (answerId === bestAnswerId) {
                        bestAnswerAlsoInAnswers = true;
                        console.log(
                          `- 找到了! 最佳答案也存在于answers数组中 (index: ${i})`,
                        );
                        break;
                      }
                    }
                    if (!bestAnswerAlsoInAnswers) {
                      console.log(
                        `- 警告: 最佳答案不在answers数组中，这可能导致回答计数错误!`,
                      );
                    }
                  }
                }
              }

              // 解析问题的answers数组
              const parsedAnswers = Array.isArray(fields.answers)
                ? fields.answers.map((a: any) => {
                    // 判断回答是普通对象还是 moveObject
                    const answerFields = a.fields ? a.fields : a;
                    const answerId = answerFields.id?.id || a.id || undefined;
                    // 增加回答者检查逻辑
                    let answerer = answerFields.answerer;
                    // 检查回答者字段是否存在
                    if (!answerer) {
                      console.warn(
                        `Missing answerer field in answer for question ${q.data!.objectId}`,
                      );
                      console.log(
                        `Answer fields available:`,
                        Object.keys(answerFields),
                      );
                      // 尝试从其他可能的字段获取
                      if (a.answerer) {
                        answerer = a.answerer;
                        console.log(
                          `Found answerer in parent object: ${answerer}`,
                        );
                      } else {
                        console.error(
                          `Cannot find answerer for answer in question ${q.data!.objectId}`,
                        );
                        answerer = "unknown-answerer";
                      }
                    }

                    // 处理回答内容 - 可能是字节数组或字符串
                    let answerContent = "No content available";
                    const answerContentField =
                      answerFields.answer_content || answerFields.answerContent;

                    if (Array.isArray(answerContentField)) {
                      try {
                        answerContent = new TextDecoder().decode(
                          new Uint8Array(answerContentField),
                        );
                      } catch (err) {
                        console.error("Error decoding answer content:", err);
                      }
                    } else if (typeof answerContentField === "string") {
                      answerContent = answerContentField;
                    }

                    // 构建回答对象
                    const answerObject = {
                      id: answerId,
                      questionId: q.data!.objectId,
                      answerer: answerer,
                      answerContent: answerContent,
                      images: answerFields.images
                        ? (answerFields.images as number[][]).map(
                            (img: number[]) =>
                              new TextDecoder().decode(new Uint8Array(img)),
                          )
                        : undefined,
                      extraAnswerers:
                        answerFields.extra_answerers ||
                        answerFields.extraAnswerers ||
                        [],
                      extraContent: Array.isArray(
                        answerFields.extra_content || answerFields.extraContent,
                      )
                        ? (
                            answerFields.extra_content ||
                            answerFields.extraContent
                          ).map((c: any) => {
                            const commentFields = c.fields ? c.fields : c;
                            let commentContent = "No content available";
                            const commentContentField =
                              commentFields.answer_content ||
                              commentFields.answerContent;

                            if (Array.isArray(commentContentField)) {
                              try {
                                commentContent = new TextDecoder().decode(
                                  new Uint8Array(commentContentField),
                                );
                              } catch (err) {
                                console.error(
                                  "Error decoding comment content:",
                                  err,
                                );
                              }
                            } else if (
                              typeof commentContentField === "string"
                            ) {
                              commentContent = commentContentField;
                            }

                            return {
                              id: commentFields.id?.id || c.id || undefined,
                              answerer: commentFields.answerer,
                              answerContent: commentContent,
                              images: commentFields.images
                                ? (commentFields.images as number[][]).map(
                                    (img: number[]) =>
                                      new TextDecoder().decode(
                                        new Uint8Array(img),
                                      ),
                                  )
                                : undefined,
                              createTime: safeParseTimestamp(
                                commentFields.time ||
                                  commentFields.create_time ||
                                  commentFields.createTime,
                                0,
                              ),
                            };
                          })
                        : [],
                      createTime: safeParseTimestamp(
                        answerFields.time ||
                          answerFields.create_time ||
                          answerFields.createTime ||
                          fields.create_time + 1000,
                        0,
                      ),
                      upvotes: answerFields.upvotes
                        ? Number(answerFields.upvotes)
                        : 0,
                      downvotes: answerFields.downvotes
                        ? Number(answerFields.downvotes)
                        : 0,
                    };

                    // 打印调试信息
                    console.log(
                      `Parsed answer for question ${q.data!.objectId}:`,
                      {
                        id: answerObject.id,
                        answerer: answerObject.answerer,
                        contentLength: answerObject.answerContent.length,
                      },
                    );

                    return answerObject;
                  })
                : [];

              // 解析最佳答案（如果存在）
              let parsedBestAnswer: AnswerData | undefined = undefined;
              if (fields.best_answer) {
                console.log("开始解析最佳答案");
                const bestAnswerFields =
                  fields.best_answer.fields || fields.best_answer;

                console.log("最佳答案字段:", Object.keys(bestAnswerFields));

                // 增加回答者检查逻辑
                let answerer = bestAnswerFields.answerer;
                console.log("原始最佳答案answerer:", answerer);

                // 检查回答者字段是否存在
                if (!answerer) {
                  console.warn(
                    `Missing answerer field in best answer for question ${q.data!.objectId}`,
                  );
                  console.log(
                    `Best answer fields available:`,
                    Object.keys(bestAnswerFields),
                  );

                  // 尝试从其他可能的字段获取
                  if (fields.best_answer.answerer) {
                    answerer = fields.best_answer.answerer;
                    console.log(`Found answerer in parent object: ${answerer}`);
                  } else {
                    console.error(
                      `Cannot find answerer for best answer in question ${q.data!.objectId}`,
                    );
                    answerer = "unknown-answerer";
                  }
                }

                let answerContent = "No content available";

                // 处理answer_content字段
                if (Array.isArray(bestAnswerFields.answer_content)) {
                  try {
                    answerContent = new TextDecoder().decode(
                      new Uint8Array(bestAnswerFields.answer_content),
                    );
                    console.log(
                      "成功解码最佳答案内容:",
                      answerContent.substring(0, 30) + "...",
                    );
                  } catch (err) {
                    console.error("解码最佳答案内容失败:", err);
                  }
                }

                parsedBestAnswer = {
                  id: bestAnswerFields.id?.id || "unknown-id",
                  questionId: q.data!.objectId,
                  answerer: answerer,
                  answerContent: answerContent,
                  images: bestAnswerFields.images
                    ? (bestAnswerFields.images as number[][]).map(
                        (img: number[]) =>
                          new TextDecoder().decode(new Uint8Array(img)),
                      )
                    : [],
                  extraAnswerers: bestAnswerFields.extra_answerers || [],
                  extraContent: Array.isArray(bestAnswerFields.extra_content)
                    ? bestAnswerFields.extra_content.map((c: any) => {
                        const commentFields = c.fields || c;
                        return {
                          id: commentFields.id?.id || "unknown-comment-id",
                          answerer:
                            commentFields.answerer || "unknown-commenter",
                          answerContent: Array.isArray(
                            commentFields.answer_content,
                          )
                            ? new TextDecoder().decode(
                                new Uint8Array(commentFields.answer_content),
                              )
                            : "No comment content available",
                          images: commentFields.images
                            ? (commentFields.images as number[][]).map(
                                (img: number[]) =>
                                  new TextDecoder().decode(new Uint8Array(img)),
                              )
                            : [],
                          createTime: safeParseTimestamp(
                            commentFields.time ||
                              commentFields.create_time ||
                              commentFields.createTime,
                            0,
                          ),
                        };
                      })
                    : [],
                  createTime: safeParseTimestamp(
                    bestAnswerFields.time ||
                      bestAnswerFields.create_time ||
                      fields.create_time + 2000,
                    Date.now(),
                  ),
                  upvotes: Number(bestAnswerFields.upvotes) || 0,
                  downvotes: Number(bestAnswerFields.downvotes) || 0,
                };

                console.log(`解析完成的最佳答案信息:`, {
                  id: parsedBestAnswer.id,
                  answerer: parsedBestAnswer.answerer,
                  contentPreview:
                    parsedBestAnswer.answerContent.substring(0, 30) + "...",
                });

                // 检查最佳答案是否已经在答案列表中
                const bestAnswerIndex = parsedAnswers.findIndex(
                  (a: AnswerData) => a.id === parsedBestAnswer!.id,
                );
                if (bestAnswerIndex === -1) {
                  console.log(
                    `最佳答案不在answers数组中，添加到数组以确保计数正确`,
                  );
                  parsedAnswers.push(parsedBestAnswer);
                } else {
                  console.log(`最佳答案已经在answers数组中，无需添加`);
                }
              }

              return {
                id: q.data!.objectId,
                asker: (fields.asker as string) || "unknown",
                content: (() => {
                  try {
                    if (typeof fields.content === "string") {
                      return fields.content;
                    }
                    if (Array.isArray(fields.content)) {
                      // 尝试使用 TextDecoder 解码
                      try {
                        return new TextDecoder().decode(
                          new Uint8Array(fields.content),
                        );
                      } catch (err) {
                        console.warn(
                          "TextDecoder failed, trying fallback method:",
                          err,
                        );
                        // 如果 TextDecoder 失败，尝试直接转换字节数组
                        return fields.content
                          .map((byte: number) => String.fromCharCode(byte))
                          .join("");
                      }
                    }
                    return "Question content unavailable";
                  } catch (err) {
                    console.error("Error decoding question content:", err);
                    return "Error decoding content";
                  }
                })(),
                images: (() => {
                  try {
                    if (fields.images) {
                      // Try to extract custom expiry time from images
                      extractExpiryFromImages(fields.images);
                      // Return processed images for UI display, filtering out expiry info
                      return (fields.images as number[][])
                        .map((img: number[]) => {
                          try {
                            const imgText = new TextDecoder().decode(
                              new Uint8Array(img),
                            );
                            return imgText.startsWith("expiry:")
                              ? null
                              : imgText;
                          } catch (err) {
                            return null;
                          }
                        })
                        .filter(
                          (img): img is string => img !== null,
                        ) as string[]; // Type guard to ensure array is string[]
                    }
                    return undefined;
                  } catch (err) {
                    console.error("Error processing images:", err);
                    return undefined;
                  }
                })(),
                answerers: (fields.answerers as string[]) || [],
                answers: parsedAnswers.map((answer: AnswerData) => ({
                  ...answer,
                  answerContent: (() => {
                    try {
                      return answer.answerContent;
                    } catch (err) {
                      console.error("Error decoding answer content:", err);
                      return "Error decoding content";
                    }
                  })(),
                })),
                bountyAmount: Number(fields.bounty_amount) || 0,
                answered: (fields.answered as boolean) || false,
                bestAnswer: parsedBestAnswer
                  ? {
                      ...parsedBestAnswer,
                      answerContent: (() => {
                        try {
                          return parsedBestAnswer.answerContent;
                        } catch (err) {
                          console.error(
                            "Error decoding best answer content:",
                            err,
                          );
                          return "Error decoding content";
                        }
                      })(),
                    }
                  : undefined,
                createTime: (() => {
                  return safeParseTimestamp(
                    fields.create_time,
                    Date.now() - 86400000,
                  );
                })(),
                endTime: (() => {
                  // Calculate end time based on contract data or custom expiry
                  const contractEndTime = safeParseTimestamp(
                    fields.end_time,
                    0,
                  );
                  const createTime = safeParseTimestamp(
                    fields.create_time,
                    Date.now() - 86400000,
                  );

                  // Try to get custom expiry time from images
                  const customExpiry = fields.images
                    ? extractExpiryFromImages(fields.images)
                    : null;

                  if (customExpiry && createTime) {
                    // Calculated end time = create time + expiry time
                    const calculatedEndTime = createTime + customExpiry;

                    // Use the calculated time if it differs significantly from contract's end_time
                    if (
                      !contractEndTime ||
                      Math.abs(calculatedEndTime - contractEndTime) > 3600000
                    ) {
                      console.log(
                        `Using custom expiry time for question ${q.data!.objectId}: ${new Date(calculatedEndTime).toISOString()}`,
                      );
                      return calculatedEndTime;
                    }
                  }

                  // If no custom expiry or it matches contract, use contract end time
                  if (contractEndTime) {
                    return contractEndTime;
                  }

                  // Fallback to default 15 days if no end time is available
                  return createTime + 15 * 24 * 60 * 60 * 1000;
                })(),
              } as QuestionData;
            } catch (err) {
              console.error(`Error parsing question ${q.data?.objectId}:`, err);
              return null;
            }
          })
          .filter((q): q is QuestionData => q !== null);

        if (parsedQuestions.length === 0) {
          console.warn("Failed to parse any questions, returning empty array");
          return [];
        }

        // 打印每个问题的ID和回答者信息进行调试
        parsedQuestions.forEach((question) => {
          console.log(
            `调试问题数据 - 问题ID: ${question.id}, 提问者: ${question.asker}`,
          );
          console.log(`问题回答数量: ${question.answers.length}`);

          if (question.answers.length > 0) {
            console.log(`回答者列表:`);
            question.answers.forEach((answer, index) => {
              console.log(`  回答 #${index + 1}:`);
              console.log(`    回答ID: ${answer.id || "未知ID"}`);
              console.log(`    回答者: ${answer.answerer || "未知回答者"}`);
              console.log(
                `    内容预览: ${answer.answerContent.substring(0, 30)}...`,
              );
            });
          }

          if (question.bestAnswer) {
            console.log(`最佳回答:`);
            console.log(`  回答ID: ${question.bestAnswer.id}`);
            console.log(`  回答者: ${question.bestAnswer.answerer}`);
            console.log(
              `  内容预览: ${question.bestAnswer.answerContent.substring(0, 30)}...`,
            );
          }

          console.log("------------------------------------------------");
        });

        console.log(`Successfully parsed ${parsedQuestions.length} questions`);
        return parsedQuestions;
      } catch (err) {
        retries++;

        // 如果是最后一次重试，直接返回空数组
        if (retries >= maxRetries) {
          console.warn(
            `Failed to fetch questions after ${maxRetries} attempts, returning empty array`,
          );
          return [];
        }

        // 指数退避策略
        const waitTime = Math.min(1000 * Math.pow(2, retries), 10000);
        console.log(
          `Request failed, retrying in ${waitTime}ms (attempt ${retries}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    return []; // 确保总是返回数组
  } catch (error) {
    console.error("Error fetching questions:", error);
    return []; // 确保总是返回数组
  }
}

// Get a question by ID
export async function getQuestionById(
  id: string,
  suiClient: SuiClient,
): Promise<QuestionData | undefined> {
  try {
    console.log(`========= 开始获取问题详情 ID: ${id} =========`);

    const question = await suiClient.getObject({
      id,
      options: { showContent: true },
    });

    // 打印原始区块链返回的数据
    console.log(
      "从区块链获取的原始问题数据:",
      JSON.stringify(question, null, 2),
    );

    if (
      !question.data?.content ||
      question.data.content.dataType !== "moveObject"
    ) {
      console.error("问题数据无效或不存在");
      return undefined;
    }

    const moveObject = question.data.content;
    if (moveObject.dataType !== "moveObject") {
      console.error("问题数据类型错误");
      return undefined;
    }

    const fields = moveObject.fields as any;
    // 打印关键字段
    console.log("问题字段解析:", {
      id: question.data.objectId,
      asker: fields.asker,
      content: typeof fields.content,
      answered: fields.answered,
      bestAnswer: fields.best_answer ? "存在" : "不存在",
      answerers: fields.answerers,
    });

    // 调试answerers数组和answers的对应关系
    if (Array.isArray(fields.answerers) && fields.answerers.length > 0) {
      console.log("回答者列表:", fields.answerers);
      console.log("answers数组:", fields.answers ? fields.answers.length : 0);

      // 检查answerers和answers的索引对应关系
      if (Array.isArray(fields.answers)) {
        fields.answers.forEach((answer: any, index: number) => {
          const answerFields = answer.fields || answer;
          const answerer = answerFields.answerer || "unknown";
          const expectedAnswerer =
            fields.answerers.length > index
              ? fields.answerers[index]
              : "不存在";

          console.log(
            `答案 #${index} - 回答者: ${answerer}, 预期回答者: ${expectedAnswerer}`,
          );
        });
      }
    }

    // 如果有最佳答案，打印最佳答案详情
    if (fields.best_answer) {
      console.log("最佳答案原始数据:", fields.best_answer);
      console.log("最佳答案类型:", typeof fields.best_answer);
      if (typeof fields.best_answer === "object") {
        console.log("最佳答案字段:", Object.keys(fields.best_answer));
        if (fields.best_answer.answer_content) {
          console.log(
            "最佳答案内容类型:",
            typeof fields.best_answer.answer_content,
          );
          if (Array.isArray(fields.best_answer.answer_content)) {
            try {
              console.log(
                "最佳答案解码内容:",
                new TextDecoder().decode(
                  new Uint8Array(fields.best_answer.answer_content),
                ),
              );
            } catch (err) {
              console.error("解码最佳答案内容失败:", err);
            }
          }
        }
      }
    }

    const questionId = question.data.objectId;

    // 解析问题的answers数组
    const parsedAnswers = Array.isArray(fields.answers)
      ? fields.answers.map((a: any) => {
          // 判断回答是普通对象还是 moveObject
          const answerFields = a.fields ? a.fields : a;
          const answerId = answerFields.id?.id || a.id || undefined;
          // 增加回答者检查逻辑
          let answerer = answerFields.answerer;
          // 检查回答者字段是否存在
          if (!answerer) {
            console.warn(
              `Missing answerer field in answer for question ${questionId}`,
            );
            console.log(`Answer fields available:`, Object.keys(answerFields));
            // 尝试从其他可能的字段获取
            if (a.answerer) {
              answerer = a.answerer;
              console.log(`Found answerer in parent object: ${answerer}`);
            } else {
              console.error(
                `Cannot find answerer for answer in question ${questionId}`,
              );
              answerer = "unknown-answerer";
            }
          }

          // 处理回答内容 - 可能是字节数组或字符串
          let answerContent = "No content available";
          const answerContentField =
            answerFields.answer_content || answerFields.answerContent;

          if (Array.isArray(answerContentField)) {
            try {
              answerContent = new TextDecoder().decode(
                new Uint8Array(answerContentField),
              );
            } catch (err) {
              console.error("Error decoding answer content:", err);
            }
          } else if (typeof answerContentField === "string") {
            answerContent = answerContentField;
          }

          // 构建回答对象
          const answerObject = {
            id: answerId,
            questionId: questionId,
            answerer: answerer,
            answerContent: answerContent,
            images: answerFields.images
              ? (answerFields.images as number[][]).map((img: number[]) =>
                  new TextDecoder().decode(new Uint8Array(img)),
                )
              : undefined,
            extraAnswerers:
              answerFields.extra_answerers || answerFields.extraAnswerers || [],
            extraContent: Array.isArray(
              answerFields.extra_content || answerFields.extraContent,
            )
              ? (answerFields.extra_content || answerFields.extraContent).map(
                  (c: any) => {
                    const commentFields = c.fields ? c.fields : c;
                    let commentContent = "No content available";
                    const commentContentField =
                      commentFields.answer_content ||
                      commentFields.answerContent;

                    if (Array.isArray(commentContentField)) {
                      try {
                        commentContent = new TextDecoder().decode(
                          new Uint8Array(commentContentField),
                        );
                      } catch (err) {
                        console.error("Error decoding comment content:", err);
                      }
                    } else if (typeof commentContentField === "string") {
                      commentContent = commentContentField;
                    }

                    return {
                      id: commentFields.id?.id || c.id || undefined,
                      answerer: commentFields.answerer,
                      answerContent: commentContent,
                      images: commentFields.images
                        ? (commentFields.images as number[][]).map(
                            (img: number[]) =>
                              new TextDecoder().decode(new Uint8Array(img)),
                          )
                        : undefined,
                      createTime: safeParseTimestamp(
                        commentFields.time ||
                          commentFields.create_time ||
                          commentFields.createTime,
                        0,
                      ),
                    };
                  },
                )
              : [],
            createTime: safeParseTimestamp(
              answerFields.time ||
                answerFields.create_time ||
                answerFields.createTime ||
                fields.create_time + 1000,
              0,
            ),
            upvotes: answerFields.upvotes ? Number(answerFields.upvotes) : 0,
            downvotes: answerFields.downvotes
              ? Number(answerFields.downvotes)
              : 0,
          };

          // 打印调试信息
          console.log(`Parsed answer for question ${questionId}:`, {
            id: answerObject.id,
            answerer: answerObject.answerer,
            contentLength: answerObject.answerContent.length,
          });

          return answerObject;
        })
      : [];

    // 解析最佳答案（如果存在）
    let parsedBestAnswer: AnswerData | undefined = undefined;
    if (fields.best_answer) {
      console.log("开始解析最佳答案");
      const bestAnswerFields = fields.best_answer.fields || fields.best_answer;

      console.log("最佳答案字段:", Object.keys(bestAnswerFields));

      // 增加回答者检查逻辑
      let answerer = bestAnswerFields.answerer;
      console.log("原始最佳答案answerer:", answerer);

      // 检查回答者字段是否存在
      if (!answerer) {
        console.warn(
          `Missing answerer field in best answer for question ${questionId}`,
        );
        console.log(
          `Best answer fields available:`,
          Object.keys(bestAnswerFields),
        );

        // 尝试从其他可能的字段获取
        if (fields.best_answer.answerer) {
          answerer = fields.best_answer.answerer;
          console.log(`Found answerer in parent object: ${answerer}`);
        } else {
          console.error(
            `Cannot find answerer for best answer in question ${questionId}`,
          );
          answerer = "unknown-answerer";
        }
      }

      let answerContent = "No content available";

      // 处理answer_content字段
      if (Array.isArray(bestAnswerFields.answer_content)) {
        try {
          answerContent = new TextDecoder().decode(
            new Uint8Array(bestAnswerFields.answer_content),
          );
          console.log(
            "成功解码最佳答案内容:",
            answerContent.substring(0, 30) + "...",
          );
        } catch (err) {
          console.error("解码最佳答案内容失败:", err);
        }
      }

      parsedBestAnswer = {
        id: bestAnswerFields.id?.id || "unknown-id",
        questionId: questionId,
        answerer: answerer,
        answerContent: answerContent,
        images: bestAnswerFields.images
          ? (bestAnswerFields.images as number[][]).map((img: number[]) =>
              new TextDecoder().decode(new Uint8Array(img)),
            )
          : [],
        extraAnswerers: bestAnswerFields.extra_answerers || [],
        extraContent: Array.isArray(bestAnswerFields.extra_content)
          ? bestAnswerFields.extra_content.map((c: any) => {
              const commentFields = c.fields || c;
              return {
                id: commentFields.id?.id || "unknown-comment-id",
                answerer: commentFields.answerer || "unknown-commenter",
                answerContent: Array.isArray(commentFields.answer_content)
                  ? new TextDecoder().decode(
                      new Uint8Array(commentFields.answer_content),
                    )
                  : "No comment content available",
                images: commentFields.images
                  ? (commentFields.images as number[][]).map((img: number[]) =>
                      new TextDecoder().decode(new Uint8Array(img)),
                    )
                  : [],
                createTime: safeParseTimestamp(
                  commentFields.time ||
                    commentFields.create_time ||
                    commentFields.createTime,
                  0,
                ),
              };
            })
          : [],
        createTime: safeParseTimestamp(
          bestAnswerFields.time ||
            bestAnswerFields.create_time ||
            fields.create_time + 2000,
          Date.now(),
        ),
        upvotes: Number(bestAnswerFields.upvotes) || 0,
        downvotes: Number(bestAnswerFields.downvotes) || 0,
      };

      console.log(`解析完成的最佳答案信息:`, {
        id: parsedBestAnswer.id,
        answerer: parsedBestAnswer.answerer,
        contentPreview: parsedBestAnswer.answerContent.substring(0, 30) + "...",
      });

      // 检查最佳答案是否已经在答案列表中
      const bestAnswerIndex = parsedAnswers.findIndex(
        (a: AnswerData) => a.id === parsedBestAnswer!.id,
      );
      if (bestAnswerIndex === -1) {
        console.log(`最佳答案不在answers数组中，添加到数组以确保计数正确`);
        parsedAnswers.push(parsedBestAnswer);
      } else {
        console.log(`最佳答案已经在answers数组中，无需添加`);
      }
    }

    return {
      id: questionId,
      asker: fields.asker as string,
      content: (() => {
        try {
          if (typeof fields.content === "string") {
            return fields.content;
          }
          if (Array.isArray(fields.content)) {
            // 尝试使用 TextDecoder 解码
            try {
              return new TextDecoder().decode(new Uint8Array(fields.content));
            } catch (err) {
              console.warn("TextDecoder failed, trying fallback method:", err);
              // 如果 TextDecoder 失败，尝试直接转换字节数组
              return fields.content
                .map((byte: number) => String.fromCharCode(byte))
                .join("");
            }
          }
          return "Question content unavailable";
        } catch (err) {
          console.error("Error decoding question content:", err);
          return "Error decoding content";
        }
      })(),
      images: (() => {
        try {
          if (fields.images) {
            // Try to extract custom expiry time from images
            extractExpiryFromImages(fields.images);
            // Return processed images for UI display, filtering out expiry info
            return (fields.images as number[][])
              .map((img: number[]) => {
                try {
                  const imgText = new TextDecoder().decode(new Uint8Array(img));
                  return imgText.startsWith("expiry:") ? null : imgText;
                } catch (err) {
                  return null;
                }
              })
              .filter((img): img is string => img !== null) as string[]; // Type guard to ensure array is string[]
          }
          return undefined;
        } catch (err) {
          console.error("Error processing images:", err);
          return undefined;
        }
      })(),
      answerers: (fields.answerers as string[]) || [],
      answers: parsedAnswers.map((answer: AnswerData) => ({
        ...answer,
        answerContent: (() => {
          try {
            return answer.answerContent;
          } catch (err) {
            console.error("Error decoding answer content:", err);
            return "Error decoding content";
          }
        })(),
      })),
      bountyAmount: Number(fields.bounty_amount) || 0,
      answered: (fields.answered as boolean) || false,
      bestAnswer: parsedBestAnswer
        ? {
            ...parsedBestAnswer,
            answerContent: (() => {
              try {
                return parsedBestAnswer.answerContent;
              } catch (err) {
                console.error("Error decoding best answer content:", err);
                return "Error decoding content";
              }
            })(),
          }
        : undefined,
      createTime: (() => {
        return safeParseTimestamp(fields.create_time, Date.now() - 86400000);
      })(),
      endTime: (() => {
        // Calculate end time based on contract data or custom expiry
        const contractEndTime = safeParseTimestamp(fields.end_time, 0);
        const createTime = safeParseTimestamp(
          fields.create_time,
          Date.now() - 86400000,
        );

        // Try to get custom expiry time from images
        const customExpiry = fields.images
          ? extractExpiryFromImages(fields.images)
          : null;

        if (customExpiry && createTime) {
          // Calculated end time = create time + expiry time
          const calculatedEndTime = createTime + customExpiry;

          // Use the calculated time if it differs significantly from contract's end_time
          if (
            !contractEndTime ||
            Math.abs(calculatedEndTime - contractEndTime) > 3600000
          ) {
            console.log(
              `Using custom expiry time for question ${questionId}: ${new Date(calculatedEndTime).toISOString()}`,
            );
            return calculatedEndTime;
          }
        }

        // If no custom expiry or it matches contract, use contract end time
        if (contractEndTime) {
          return contractEndTime;
        }

        // Fallback to default 15 days if no end time is available
        return createTime + 15 * 24 * 60 * 60 * 1000;
      })(),
    };
  } catch (error) {
    console.error("Error fetching question by ID:", error);
    return undefined;
  }
}

// Wrapper hooks for React components
// Export functions for get operations
export function useChainOperations() {
  const { suiClient } = useSuiService();

  const getAllQuestionsFromChain = useCallback(async (): Promise<
    QuestionData[]
  > => {
    return fetchAllQuestions(suiClient);
  }, [suiClient]);

  const getQuestionByIdFromChain = useCallback(
    async (id: string): Promise<QuestionData | undefined> => {
      return getQuestionById(id, suiClient);
    },
    [suiClient],
  );

  const getQuestionsByAsker = useCallback(
    async (askerAddress: string): Promise<QuestionData[]> => {
      try {
        console.log(
          `Hook getQuestionsByAsker: Fetching questions for address ${askerAddress}`,
        );

        // 先获取全局问题信息对象，找到asker与question_information的对应关系
        const questionsInfo = await suiClient.getObject({
          id: QUESTION_INFORMATION,
          options: { showContent: true },
        });

        // 查找该用户在askers数组中的索引
        let questionIds: string[] = [];
        if (questionsInfo.data?.content?.dataType === "moveObject") {
          const infoFields = (questionsInfo.data.content as any).fields;

          // 查找用户在askers数组中的索引
          const askerIndex = infoFields.askers.findIndex(
            (a: string) => a === askerAddress,
          );
          console.log(
            `Hook: 用户${askerAddress}在askers数组中的索引: ${askerIndex}`,
          );

          // 如果找到了索引，获取对应的question_information
          if (
            askerIndex !== -1 &&
            Array.isArray(infoFields.question_information) &&
            infoFields.question_information.length > askerIndex
          ) {
            const userQuestionIds = infoFields.question_information[askerIndex];
            if (Array.isArray(userQuestionIds)) {
              questionIds = userQuestionIds;
              console.log(
                `Hook: 从全局对象中发现用户${askerAddress}提出了${questionIds.length}个问题:`,
              );
              console.log(questionIds);
            }
          }
        }

        // 获取所有问题
        const allQuestions = await fetchAllQuestions(suiClient);
        console.log(
          `Hook getQuestionsByAsker: Total questions fetched: ${allQuestions.length}`,
        );

        // 按两种方式过滤：
        // 1. 问题的asker字段匹配
        // 2. 问题ID在之前从全局映射中获取的IDs列表中
        const filteredQuestions = allQuestions.filter((q) => {
          const matchesAsker = q.asker === askerAddress;
          const inGlobalList = questionIds.includes(q.id);

          if (matchesAsker) {
            console.log(
              `Hook: Question ${q.id} matches asker field: ${askerAddress}`,
            );
          }

          if (inGlobalList) {
            console.log(
              `Hook: Question ${q.id} found in global mapping for asker: ${askerAddress}`,
            );
          }

          // 使用两种方式找到的所有问题
          return matchesAsker || inGlobalList;
        });

        console.log(
          `Hook getQuestionsByAsker: Filtered to ${filteredQuestions.length} questions by ${askerAddress}`,
        );
        return filteredQuestions;
      } catch (error) {
        console.error("Error fetching questions by asker:", error);
        return [];
      }
    },
    [suiClient],
  );

  const getQuestionsByAnswerer = useCallback(
    async (answererAddress: string): Promise<QuestionData[]> => {
      try {
        console.log(
          `Hook getQuestionsByAnswerer: Fetching answers for address ${answererAddress}`,
        );

        // 首先获取问题列表信息对象，查找answerers和answers_information的对应关系
        const questionsInfo = await suiClient.getObject({
          id: QUESTION_INFORMATION,
          options: { showContent: true },
        });

        // 查找该地址在全局对象中的信息
        let answerIds: string[] = [];
        let answererToAnswerMap = new Map<string, string[]>();

        if (questionsInfo.data?.content?.dataType === "moveObject") {
          const infoFields = (questionsInfo.data.content as any).fields;

          // 首先创建完整的answerers和answers_information的映射关系
          if (
            Array.isArray(infoFields.answerers) &&
            Array.isArray(infoFields.answers_information)
          ) {
            console.log(
              `全局信息: ${infoFields.answerers.length} answerers, ${infoFields.answers_information.length} answer arrays`,
            );

            // 保存所有answerer与其答案的对应关系，以备后续查询
            infoFields.answers_information.forEach(
              (aArray: any, index: number) => {
                if (index < infoFields.answerers.length) {
                  const answerer = infoFields.answerers[index];
                  if (Array.isArray(aArray) && answerer) {
                    answererToAnswerMap.set(answerer, aArray);
                    console.log(
                      `Mapped answerer ${answerer} to ${aArray.length} answers`,
                    );
                  }
                }
              },
            );
          }

          // 查找用户在answerers数组中的索引
          const answererIndex = infoFields.answerers.findIndex(
            (a: string) => a === answererAddress,
          );
          console.log(`Hook: 用户${answererAddress}`);
          console.log(
            `Hook: 用户${answererAddress}在answerers数组中的索引: ${answererIndex}`,
          );

          // 如果找到了索引，获取对应的answers_information
          if (
            answererIndex !== -1 &&
            Array.isArray(infoFields.answers_information) &&
            infoFields.answers_information.length > answererIndex
          ) {
            const userAnswerIds = infoFields.answers_information[answererIndex];
            if (Array.isArray(userAnswerIds)) {
              answerIds = userAnswerIds;
              console.log(
                `Hook: 从全局对象中发现用户${answererAddress}有${answerIds.length}个回答:`,
              );
              console.log(answerIds);
            }
          }
        }

        // 继续正常获取所有问题
        const allQuestions = await fetchAllQuestions(suiClient);
        console.log(
          `Hook getQuestionsByAnswerer: Found ${allQuestions.length} total questions`,
        );

        // Debug: Count answers for debugging
        let totalAnswersCount = 0;
        allQuestions.forEach((q) => {
          if (q.answers) {
            totalAnswersCount += q.answers.length;

            // 记录所有回答者，用于调试
            if (q.answers.length > 0) {
              console.log(
                `Question ${q.id} has ${q.answers.length} answers from:`,
              );
              const answerers = q.answers.map((a) => a.answerer);
              console.log(answerers.join(", "));
            }
          }

          // 记录最佳回答者
          if (q.bestAnswer) {
            console.log(
              `Question ${q.id} has best answer by ${q.bestAnswer.answerer}`,
            );
          }
        });
        console.log(
          `Hook getQuestionsByAnswerer: Total answers across all questions: ${totalAnswersCount}`,
        );

        // Filter questions - enhanced to make sure we catch all answers from this user
        const filteredQuestions = allQuestions.filter((q) => {
          // 1. Check each individual answer in the answers array
          const hasRegularAnswer =
            q.answers &&
            q.answers.some((answer) => {
              const matches = answer.answerer === answererAddress;
              if (matches) {
                console.log(
                  `Hook: Found regular answer by ${answererAddress} for question ${q.id}`,
                );
              }
              return matches;
            });

          // 2. Check if this user provided the best answer
          const hasBestAnswer =
            q.bestAnswer && q.bestAnswer.answerer === answererAddress;
          if (hasBestAnswer) {
            console.log(
              `Hook: Found best answer by ${answererAddress} for question ${q.id}`,
            );
          }

          // 3. Check if this question has any supplementary answers from this user
          const hasExtraAnswer =
            q.answers &&
            q.answers.some(
              (answer) =>
                answer.extraAnswerers &&
                answer.extraAnswerers.includes(answererAddress),
            );
          if (hasExtraAnswer) {
            console.log(
              `Hook: Found extra answer by ${answererAddress} for question ${q.id}`,
            );
          }

          // 4. Also check extraContent in each answer
          const hasExtraContent =
            q.answers &&
            q.answers.some(
              (answer) =>
                answer.extraContent &&
                answer.extraContent.some(
                  (ec) => ec.answerer === answererAddress,
                ),
            );
          if (hasExtraContent) {
            console.log(
              `Hook: Found extra content by ${answererAddress} for question ${q.id}`,
            );
          }

          // 5. Check if question ID is in global answers IDs list
          const isInGlobalAnswers = answerIds.includes(q.id);
          if (isInGlobalAnswers) {
            console.log(
              `Hook: Question ${q.id} is in the user's global answer IDs list`,
            );
          }

          // Include question if any of the above conditions are true
          return (
            hasRegularAnswer ||
            hasBestAnswer ||
            hasExtraAnswer ||
            hasExtraContent ||
            isInGlobalAnswers
          );
        });

        console.log(
          `Hook getQuestionsByAnswerer: Filtered to ${filteredQuestions.length} questions answered by ${answererAddress}`,
        );

        // Log details of each found question for debugging
        filteredQuestions.forEach((q) => {
          console.log(
            `Found question ${q.id} with answers from ${answererAddress}`,
          );
          const matchingAnswers = q.answers.filter(
            (a) => a.answerer === answererAddress,
          );
          console.log(
            `Question has ${matchingAnswers.length} direct answers from this user`,
          );
        });

        return filteredQuestions;
      } catch (error) {
        console.error("Error fetching questions by answerer:", error);
        return [];
      }
    },
    [suiClient],
  );

  const getBestAnswersByUser = useCallback(
    async (
      userAddress: string,
    ): Promise<{ question: QuestionData; answer: AnswerData }[]> => {
      try {
        const allQuestions = await fetchAllQuestions(suiClient);
        return allQuestions
          .filter((q) => q.bestAnswer?.answerer === userAddress)
          .map((q) => ({
            question: q,
            answer: q.bestAnswer!,
          }));
      } catch (error) {
        console.error("Error fetching best answers by user:", error);
        return [];
      }
    },
    [suiClient],
  );

  const updateAnswerHook = useUpdateAnswer();

  return {
    getAllQuestionsFromChain,
    getQuestionByIdFromChain,
    getQuestionsByAsker,
    getQuestionsByAnswerer,
    getBestAnswersByUser,
    updateAnswer: updateAnswerHook.updateAnswer,
  };
}

export async function getAnswersForQuestion(
  questionId: string,
  suiClient: SuiClient,
): Promise<AnswerData[]> {
  try {
    console.log(`Fetching answers for question: ${questionId}`);

    // 检查传入的参数
    if (!questionId) {
      console.error("Invalid questionId provided to getAnswersForQuestion");
      return [];
    }

    // 直接从问题的answers字段获取答案数据
    // 而不是再次调用API获取整个问题对象
    const question = await getQuestionById(questionId, suiClient);

    if (!question) {
      console.warn(`Question ${questionId} not found or invalid`);
      return [];
    }

    // 检查是否有answer数据
    if (!Array.isArray(question.answers) || question.answers.length === 0) {
      console.log(`No answers found for question ${questionId}`);
      return [];
    }

    console.log(
      `Found ${question.answers.length} answers for question ${questionId}`,
    );

    return question.answers;
  } catch (error) {
    console.error(`Error fetching answers for question ${questionId}:`, error);
    return [];
  }
}

// 添加新的详细问题获取函数
// 新增函数：调试区块链原始数据结构
// Optimized timestamp parsing function
function safeParseTimestamp(timestamp: any, defaultValue: number = 0): number {
  try {
    if (timestamp === undefined || timestamp === null) return defaultValue;

    // Check if timestamp is already a number
    if (typeof timestamp === "number") {
      const minSecondEpoch = 1577836800; // 2020-01-01 in seconds
      const maxSecondEpoch = 2524608000; // 2050-01-01 in seconds
      const minMilliEpoch = minSecondEpoch * 1000;
      const maxMilliEpoch = maxSecondEpoch * 1000;

      // Valid millisecond timestamp
      if (timestamp >= minMilliEpoch && timestamp <= maxMilliEpoch) {
        return timestamp;
      }

      // Convert from seconds to milliseconds if needed
      if (timestamp >= minSecondEpoch && timestamp <= maxSecondEpoch) {
        return timestamp * 1000;
      }
    }

    // Try to parse string or other types
    const parsedValue = Number(timestamp);
    if (!isNaN(parsedValue)) {
      // Apply the same validation as above
      return safeParseTimestamp(parsedValue, defaultValue);
    }

    return defaultValue;
  } catch {
    return defaultValue;
  }
}

// Extract expiry time from image data (optimized)
function extractExpiryFromImages(images: any[]): number | null {
  if (!Array.isArray(images) || images.length === 0) return null;

  // Check if any image contains expiry info
  for (const imgData of images) {
    try {
      // Convert image data to string
      const imgText = Array.isArray(imgData)
        ? new TextDecoder().decode(new Uint8Array(imgData))
        : typeof imgData === "string"
          ? imgData
          : "";

      // Extract expiry value if present
      if (imgText.startsWith("expiry:")) {
        const expiryValue = parseInt(imgText.substring(7), 10);
        if (!isNaN(expiryValue)) return expiryValue;
      }
    } catch (e) {
      // Silently continue to next image on error
      console.error(e);
    }
  }

  return null;
}
