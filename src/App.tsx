import { NineSlicePlane, Stage } from '@pixi/react';
import Live2dModel from './Live2DModel';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { InternalModel, Live2DModel, config as Live2dConfig, MotionPriority } from 'pixi-live2d-display-mulmotion';
import { ILive2DModelData } from './types';
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import './zip';
import { Point, Ticker } from 'pixi.js';

Live2dConfig.logLevel = Live2dConfig.LOG_LEVEL_VERBOSE;

function App() {
  const stage = useRef<Stage>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [stageHeight, setStageHeight] = useState(0);

  const [chatWidth, setChatWidth] = useState(0);
  const [chatHeight, setChatHeight] = useState(0);

  const [chatContent, setChatContent] = useState("");
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
      const chatDummy = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur sed pellentesque justo, sed suscipit turpis. Vestibulum interdum sapien sit amet diam bibendum varius. Curabitur posuere purus ullamcorper, hendrerit lectus sit amet, vestibulum leo. Mauris ullamcorper lacinia risus nec blandit. Aliquam bibendum risus eget purus fermentum, ac mattis velit finibus. Aenean ornare velit a metus ornare, lacinia tempus enim tempor. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Vestibulum et elementum mi. Proin orci urna, tincidunt sit amet pulvinar eu, pellentesque ultricies lorem. Nunc sed volutpat mi, quis mattis metus. Sed tellus mi, ultrices quis diam quis, vehicula placerat augue. Praesent nunc lorem, ornare id sagittis non, iaculis at tellus.";

      let index = 0;
      const interval = setInterval(() => {
        if (index < chatDummy.length - 1) {
          setChatContent((prev) => prev + chatDummy[index]);
          index++;
        } else {
          clearInterval(interval);
        }
      }, 20);

      await doMotion("w-adult-shakehand01");
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
