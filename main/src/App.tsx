import { Stage } from '@pixi/react';
import Live2dModel from './Live2DModel';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { InternalModel, Live2DModel, config as Live2dConfig, MotionPriority } from 'pixi-live2d-display-mulmotion';
import { Channel, invoke } from "@tauri-apps/api/core";
import "./App.css";
import './zip';
import { Ticker } from 'pixi.js';
import { listen } from '@tauri-apps/api/event';
import { Mutex } from 'async-mutex';

Live2dConfig.logLevel = Live2dConfig.LOG_LEVEL_VERBOSE;

const ipcListenMutex = new Mutex();
let ipcListening = false;

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

type IPCEvent =
  |
  {
    type: "chat";
    message: string;
  }
  ;

function App() {
  const stage = useRef<Stage>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [stageHeight, setStageHeight] = useState(0);

  const [chatWidth, setChatWidth] = useState(0);
  const [chatHeight, setChatHeight] = useState(0);

  const [chatResponse, setChatResponse] = useState("");
  const [chatResponseHistory, setChatResponseHistory] = useState<string[]>([]);
  const [chatPromptHistory, setChatPromptHistory] = useState<string[]>([]);
  const [chatting, setChatting] = useState(false);

  const live2dModel = useRef<Live2DModel<InternalModel>>(null);
  const [modelName, _setModelName] = useState<string | null>("saki");
  const [modelData, setModelData] = useState<string>();
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

  const base64ToArrayBuffer = (base64: string) => {
    const binaryString = atob(base64);

    const length = binaryString.length;
    const bytes = new Uint8Array(length);

    for (let i = 0; i < length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
  }

  // load model from zip
  useEffect(() => {
    const f = async () => {
      const modelData = await invoke("get_model_data") as string;
      const modelBlob = new Blob([base64ToArrayBuffer(modelData)]);
      const url = URL.createObjectURL(modelBlob);

      if (modelName) {
        setModelData("zip://" + url);
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

  const submitChat = async (chatPrompt: string) => {
    if (chatting || !chatPrompt) {
      return;
    }
    if (chatPrompt === "RESET") {
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

  // setup global ipc event listener
  useEffect(() => {
    let unlisten: () => void;

    ipcListenMutex.runExclusive(async () => {
      if (ipcListening) {
        return;
      }

      const wrapper = async () => {
        const u = await listen<IPCEvent>("ipc-event", async (event) => {
          const payload = event.payload;
          switch (payload.type) {
            case "chat":
              await submitChat(payload.message);
              break;
            default:
              // do nothing
              break;
          }
        });

        unlisten = u;
      };

      wrapper();
      ipcListening = true;
    })

    return () => {
      if (unlisten) {
        unlisten();
        ipcListening = false;
      }
    }
  }, [])

  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'flex-end' }}>
      <div
        className={`chat ${chatResponse ? 'visible' : ''}`}
        style={{
          width: chatWidth,
          minHeight: "auto",
          maxHeight: chatHeight,
          visibility: chatResponse ? 'visible' : 'hidden',
          marginBottom: '20px',
          alignSelf: 'center'
        }}
      >
        <p className="chat-child">
          {chatResponse}
        </p>
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
