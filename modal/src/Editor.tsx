import { invoke } from '@tauri-apps/api/core';
import './editor.css'

import { EditorProvider, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

function Editor() {
  const extensions = [
    StarterKit.configure({
      bulletList: {
        keepMarks: true,
        keepAttributes: false,
      },
      orderedList: {
        keepMarks: true,
        keepAttributes: false,
      },
    }),

    Extension.create({
      name: "custom-keymap",

      addKeyboardShortcuts() {
        return {
          "Mod-Enter": () => {
            handleSubmit();
            return true;
          },
        }
      },
    }),
  ];

  const handleSubmit = () => {
    const f = async () => {
      await invoke("send_chat");
    };

    f();
  };

  return (
    <EditorProvider extensions={extensions}></EditorProvider>
  );
}

export default Editor;
