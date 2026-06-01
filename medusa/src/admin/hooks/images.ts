import type { HttpTypes } from '@medusajs/framework/types';
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';

type FileReaderLike = {
  result: string | ArrayBuffer | null;
  onload: null | (() => void);
  onerror: null | ((error: unknown) => void);
  readAsDataURL(file: Blob): void;
};

type FileListLike = Iterable<File> & {
  length: number;
  item(index: number): File | null;
};

const isFileListLike = (value: unknown): value is FileListLike => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'length' in value &&
    typeof value.length === 'number' &&
    'item' in value &&
    typeof value.item === 'function' &&
    Symbol.iterator in value
  );
};

const getFileBase64EncodedContent = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const FileReaderCtor = (
      globalThis as typeof globalThis & {
        FileReader: new () => FileReaderLike;
      }
    ).FileReader;
    const reader = new FileReaderCtor();
    reader.onload = () => {
      resolve(
        (reader.result as string).replace('data:', '').replace(/^.+,/, ''),
      );
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const createPayload = async (payload: HttpTypes.AdminUploadFile) => {
  if (isFileListLike(payload)) {
    const formData = new FormData();
    for (const file of payload) {
      formData.append('files', file);
    }
    return formData;
  }

  if (payload.files.every((f: File | { name: string; content: string }) => f instanceof File)) {
    const formData = new FormData();
    for (const file of payload.files) {
      formData.append('files', file);
    }
    return formData;
  }

  const obj: {
    files: {
      name: string;
      content: string;
    }[];
  } = {
    files: [],
  };

  for (const file of payload.files) {
    if (file instanceof File) {
      obj.files.push({
        name: file.name,
        content: await getFileBase64EncodedContent(file),
      });
    } else {
      obj.files.push(file);
    }
  }

  return JSON.stringify(obj);
};

export const useAdminUploadImage = (
  options?: UseMutationOptions<
    HttpTypes.AdminFileListResponse,
    Error,
    HttpTypes.AdminUploadFile
  >,
) => {
  return useMutation<
    HttpTypes.AdminFileListResponse,
    Error,
    HttpTypes.AdminUploadFile
  >({
    mutationKey: ['admin-upload-image'],
    mutationFn: async (payload) => {
      const res = await fetch(`/admin/uploads`, {
        method: 'POST',
        body: await createPayload(payload),
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(res.statusText);
      }

      return res.json() as Promise<HttpTypes.AdminFileListResponse>;
    },
    ...options,
  });
};
