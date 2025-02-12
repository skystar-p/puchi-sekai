import { Stage } from '@pixi/react';
import Live2dModel from './Live2DModel';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      // stage and chat width is window width
      const stageWidth = windowWidth;
      const chatWidth = windowWidth;
      setStageWidth(stageWidth);
      setChatWidth(chatWidth);

      // evenly split height
      const stageHeight = windowHeight / 2;
      const chatHeight = windowHeight / 2;
      setStageHeight(stageHeight);
      setChatHeight(chatHeight);

      // now position and scale the model correctly
      if (live2dModel.current) {
        const live2dTrueWidth = live2dModel.current.internalModel.originalWidth;
        const live2dTrueHeight = live2dModel.current.internalModel.originalHeight;

        // every part of model should be visible, so scale to fit
        let scale = Math.min(
          stageWidth / live2dTrueWidth,
          stageHeight / live2dTrueHeight
        );

        // actual model upper part is empty, so add some scale
        const additionalScale = 0.3333;
        scale *= (1 + additionalScale);
        setLive2dScale(scale);
        const live2dScaledWidth = live2dTrueWidth * scale;
        const live2dScaledHeight = live2dTrueHeight * scale;

        // position to center
        const live2dX = (stageWidth - live2dScaledWidth) / 2;
        const live2dY = (stageHeight - live2dScaledHeight) / 2;

        // now the model is slightly below the center because of additional scaling, so adjust
        // consider ratio of upper empty part and lower empty part
        const modelYAdjust = -live2dScaledHeight * (0.8 / 15);
        setLive2dX(live2dX);
        setLive2dY(live2dY + modelYAdjust);
      }
    }
  }, [modelData]);

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
  useLayoutEffect(() => {
    const us = updateSize;
    us();
    window.addEventListener("resize", us);

    return () => {
      window.removeEventListener("resize", us);
    }
  }, [updateSize]);

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
    let chatResponseFiltered = "";

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

          const responseTag = "<response>";

          if (chatResponse.includes(responseTag)) {
            chatResponseFiltered = chatResponse.split(responseTag)[1];

            const responseTagEnd = "</response>";
            for (let i = 0; i < responseTagEnd.length; i++) {
              if (chatResponseFiltered.endsWith(responseTagEnd.slice(0, i + 1))) {
                chatResponseFiltered = chatResponseFiltered.slice(0, -i - 1);
                break;
              }
            }
          }

          setChatResponse(chatResponseFiltered);
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
