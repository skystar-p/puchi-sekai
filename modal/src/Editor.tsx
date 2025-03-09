import { invoke } from '@tauri-apps/api/core';
import './Editor.css'

import { Extension, useEditor, EditorContent } from '@tiptap/react';
import { Color } from '@tiptap/extension-color';
import ListItem from '@tiptap/extension-list-item';
import TextStyle from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useEffect } from 'react';

const Tiptap = () => {
  const editor = useEditor({
    extensions: [
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
              if (!this.editor) return false;
              const content = this.editor.getText();
              if (content.trim()) {
                handleSubmit(content);
              }
              return true;
            },
          }
        },
      }),
    ],
    content: '<p></p>',
    autofocus: 'end',
  });

  // Ensure editor focuses when mounted
  useEffect(() => {
    if (editor) {
      setTimeout(() => {
        editor.commands.focus('end');
      }, 10);
    }
  }, [editor]);

  const handleSubmit = async (content: string) => {
    if (!content.trim()) return;

    try {
      // Send the message - the Rust side will handle application exit
      await invoke("send_chat", { content });

      // The application will be terminated by the Rust side
      // No need to call window.close() here
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const onSubmitClick = useCallback(() => {
    if (!editor) return;
    const content = editor.getText();
    if (content.trim()) {
      handleSubmit(content);
    }
  }, [editor]);

  return (
    <div className="editor-wrapper">
      <div className="editor-header">
        {/* Empty header with light yellow background */}
      </div>

      <div className="editor-content">
        <EditorContent editor={editor} />
      </div>

      <div className="editor-footer">
        <button
          className="send-button"
          onClick={onSubmitClick}
          disabled={!editor?.getText().trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
};

function Editor() {
  return <Tiptap />;
}

export default Editor;
