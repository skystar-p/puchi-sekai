import { invoke } from '@tauri-apps/api/core';
import './Editor.css'

import { EditorProvider, Extension } from '@tiptap/react';
import { Color } from '@tiptap/extension-color';
import ListItem from '@tiptap/extension-list-item';
import TextStyle from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';

function Editor() {
  const extensions = [
    Color.configure({ types: [TextStyle.name, ListItem.name] }),
    TextStyle.configure({ mergeNestedSpanStyles: true }),
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
            const content = this.editor.getText();
            handleSubmit(content);
            return true;
          },
        }
      },
    }),
  ];

  const handleSubmit = (content: string) => {
    const f = async () => {
      await invoke("send_chat", { content });
    };

    f();
  };

  return (
    <EditorProvider extensions={extensions}></EditorProvider>
  );
}

export default Editor;
