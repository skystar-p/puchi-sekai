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

  const [chatContent, setChatContent] = useState("");
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
      setChatContent("");
      setChatting(true);
      await doMotion("w-adult-think01");
      const chat = "Rust 프로그래밍 언어에 대해서 알려줘!";

      let chatResponse = "";

      const onEvent = new Channel<ChatEvent>();
      onEvent.onmessage = async (event) => {
        switch (event.event) {
          case "started":
            await doMotion("w-cool-posenod01");
            break
          case "response":
            chatResponse += event.data.content;
            setChatContent(chatResponse);
            break;
          case "finished":
            setChatting(false);
            await doMotion("w-adult-shakehand01");
            await doMotion("w-cool-posenod01");
            break;
          case "error":
            setChatting(false);
            setChatContent(event.data.message);
            break;
          default:
            break;
        }
      };

      await invoke("chat", {
        content: chat,
        onEvent,
      })
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
          {chatContent}
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
