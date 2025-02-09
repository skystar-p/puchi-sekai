import { Stage } from '@pixi/react';
import Live2dModel from './Live2DModel';
import { useCallback, useEffect, useRef, useState } from 'react';
import { InternalModel, Live2DModel, config as Live2dConfig, MotionPriority } from 'pixi-live2d-display-mulmotion';
import { ILive2DModelData } from './types';
import { Channel, invoke } from "@tauri-apps/api/core";
import "./App.css";
import './zip';
import { Ticker } from 'pixi.js';

Live2dConfig.logLevel = Live2dConfig.LOG_LEVEL_VERBOSE;

type ChatEvent =
  |
  {
    event: "started";
  }
  |
  {
    event: "response";
    data: {
      content: string;
    }
  }
  |
  {
    event: "finished";
  }
  |
  {
    event: "error";
    data: {
      message: string;
    }
  }
  ;

function App() {
  const stage = useRef<Stage>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [stageHeight, setStageHeight] = useState(0);

  const [chatWidth, setChatWidth] = useState(0);
  const [chatHeight, setChatHeight] = useState(0);

  const [chatResponse, setChatResponse] = useState("");
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatResponseHistory, setChatResponseHistory] = useState<string[]>([]);
  const [chatPromptHistory, setChatPromptHistory] = useState<string[]>([]);
  const chatPromptRef = useRef<HTMLInputElement>(null);
  const [chatting, setChatting] = useState(false);

  const live2dModel = useRef<Live2DModel<InternalModel>>(null);
  const [modelName, _setModelName] = useState<string | null>("02saki_normal");
  const [modelData, setModelData] = useState<ILive2DModelData | string>();
  const [live2dX, setLive2dX] = useState(0);
  const [live2dY, setLive2dY] = useState(0);
  const [live2dScale, setLive2dScale] = useState(1);

  const updateSize = useCallback(() => {
    if (modelData) {
      const styleWidth = window.innerWidth;
      const styleHeight = window.innerHeight;

      // fix this height
      const stageHeightFixed = 450;
      const modelYAdjust = -100;

      const modelHeight = stageHeightFixed;
      const chatHeight = styleHeight - modelHeight;

      setStageWidth(styleWidth);
      setStageHeight(modelHeight);

      setChatWidth(styleWidth);
      setChatHeight(chatHeight);

      if (live2dModel.current) {
        const live2dTrueWidth = live2dModel.current.internalModel.originalWidth;
        const live2dTrueHeight = live2dModel.current.internalModel.originalHeight;
        let scale = Math.min(
          styleWidth / live2dTrueWidth,
          styleHeight / live2dTrueHeight
        );

        scale *= 1.5;
        // scale = (Math.round(scale * 100) / 100) * 1.5;
        setLive2dScale(scale);

        setLive2dX((styleWidth - live2dTrueWidth * scale) / 2);
        setLive2dY((styleHeight - live2dTrueHeight * scale) / 2 + modelYAdjust);
      }
    }
  }, [modelData, chatHeight]);

  const motionPairs = [
    ["w-adult-blushed04", "face_smile_09"],
    ["w-adult-think02", "face_surprise_03"],
    ["w-adult-delicious03", "face_smile_01"],
  ];

  const onLive2dModelReady = useCallback(() => {
    updateSize();

    if (!live2dModel.current) {
      return;
    }

    (async () => {
      // initial motion
      await doMotion("w-cool-posenod01");
    })();

    const model = live2dModel.current!;

    // click handler
    model.on("click", async () => {
      if (chatting) {
        return;
      }

      // random motion pair
      const pair = motionPairs[Math.floor(Math.random() * motionPairs.length)];
      await Promise.all([
        doMotion(pair[0], 0, 0),
        doMotion(pair[1], 0, 1),
      ]);
    });

    return () => {
      model.off("click");
    }

  }, [updateSize]);

  // load model from zip
  useEffect(() => {
    const f = async () => {
      if (modelName) {
        setModelData(`/${modelName}.zip`);
      }
    };

    f();
  }, [modelName]);

  // handle resize
  useEffect(() => {
    window.addEventListener("resize", updateSize);

    return () => {
      window.removeEventListener("resize", updateSize);
    }
  });

  const clearChatPrompts = () => {
    setChatResponse("");
    setChatPrompt("");
    setChatResponseHistory([]);
    if (chatPromptRef.current) {
      chatPromptRef.current.focus();
      chatPromptRef.current.value = "";
    }
  };

  const doMotion = (group: string, index: number = 0, managerIdx: number = 0) => {
    if (!live2dModel.current) {
      return;
    }

    const model = live2dModel.current!;
    model.internalModel.extendParallelMotionManager(managerIdx + 1);
    const manager = model.internalModel.parallelMotionManager[managerIdx];

    manager.startMotion(group, index, MotionPriority.FORCE);

    const done = new Promise<void>((resolve) => {
      const ticker = new Ticker();
      ticker.add(() => {
        if (manager.destroyed || manager.isFinished()) {
          ticker.stop();
          ticker.destroy();
          resolve();
        }
      });
      ticker.start();
    });

    return done
  };

  const submitChat = async () => {
    if (chatting || !chatPrompt) {
      return;
    }
    if (chatPrompt === "RESET") {
      clearChatPrompts();
      return;
    }
    let chatPromptCopy = chatPrompt;
    setChatResponse("");
    setChatting(true);
    await Promise.all([
      doMotion("w-adult-think02", 0, 0),
      doMotion("face_surprise_03", 0, 1),
    ]);

    let chatResponse = "";

    const onEvent = new Channel<ChatEvent>();
    onEvent.onmessage = async (event) => {
      switch (event.event) {
        case "started":
          await Promise.all([
            doMotion("w-cool-glad01", 0, 0),
            doMotion("face_smile_04", 0, 1),
          ]);
          break
        case "response":
          chatResponse += event.data.content;
          setChatResponse(chatResponse);
          break;
        case "finished":
          setChatting(false);
          setChatPrompt("");
          if (chatPromptRef.current) {
            chatPromptRef.current.focus();
            chatPromptRef.current.value = "";
          }
          setChatResponseHistory([...chatResponseHistory, chatResponse]);
          setChatPromptHistory([...chatPromptHistory, chatPromptCopy]);
          await Promise.all([
            doMotion("w-animal-nod01", 0, 0),
            doMotion("face_smile_09", 0, 1),
          ]);
          break;
        case "error":
          setChatting(false);
          setChatResponse("에러!");
          setChatPrompt("");
          if (chatPromptRef.current) {
            chatPromptRef.current.focus();
            chatPromptRef.current.value = "";
          }
          await Promise.all([
            doMotion("w-cool-sad01", 0, 0),
            doMotion("face_baffling_01", 0, 1),
          ]);
          break;
        default:
          break;
      }
    };

    await invoke("chat", {
      prompt: chatPrompt,
      previousPrompts: chatPromptHistory,
      previousResponses: chatResponseHistory,
      onEvent,
    })
  };

  return (
    <main>
      <div
        className="chat"
        style={{
          width: chatWidth,
          height: chatHeight,
        }}
      >
        <p className="chat-child">
          {chatResponse}
        </p>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            submitChat();
          }}
        >
          <input className="chat-child" onChange={(e) => setChatPrompt(e.currentTarget.value)} ref={chatPromptRef}>
          </input>
        </form>
      </div>
      <Stage
        width={stageWidth}
        height={stageHeight}
        ref={stage}
        options={{ backgroundAlpha: 0, antialias: true, autoDensity: true }}
      >
        <Live2dModel
          ref={live2dModel}
          modelData={modelData}
          x={live2dX}
          y={live2dY}
          scaleX={live2dScale}
          scaleY={live2dScale}
          onReady={onLive2dModelReady}
        />
      </Stage>
    </main>
  );
}

export default App;
