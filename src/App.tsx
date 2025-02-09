import { Stage } from '@pixi/react';
import Live2dModel from './Live2DModel';
import { useCallback, useEffect, useRef, useState } from 'react';
import { InternalModel, Live2DModel } from 'pixi-live2d-display-mulmotion';
import { ILive2DModelData } from './types';
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import './zip';

function App() {
  const stage = useRef<Stage>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [stageHeight, setStageHeight] = useState(0);

  const live2dModel = useRef<Live2DModel<InternalModel>>(null);
  const [modelName, setModelName] = useState<string | null>("02saki_normal");
  const [modelData, setModelData] = useState<ILive2DModelData | string>();
  const [motions, setMotions] = useState<string[]>([]);
  const [expressions, setExpressions] = useState<string[]>([]);
  const [live2dX, setLive2dX] = useState(0);
  const [live2dY, setLive2dY] = useState(0);
  const [live2dScale, setLive2dScale] = useState(1);

  const updateSize = useCallback(() => {
    if (modelData) {
      const styleWidth = 500;
      const styleHeight = 500;

      setStageWidth(styleWidth);
      setStageHeight(styleHeight);

      if (live2dModel.current) {
        const live2dTrueWidth = live2dModel.current.internalModel.originalWidth;
        const live2dTrueHeight =
          live2dModel.current.internalModel.originalHeight;
        let scale = Math.min(
          styleWidth / live2dTrueWidth,
          styleHeight / live2dTrueHeight
        );

        scale = (Math.round(scale * 100) / 100) * 1.3;
        setLive2dScale(scale);

        setLive2dX((styleWidth - live2dTrueWidth * scale) / 2);
        setLive2dY((styleHeight - live2dTrueHeight * scale) / 2);
      }
    }
  }, [modelData]);

  const onLive2dModelReady = useCallback(() => {
    updateSize();
  }, [updateSize]);

  useEffect(() => {
    const f = async () => {
      if (modelName) {
        setModelData(undefined);

        setModelData(`/${modelName}.zip`);
      }
    };

    f();
  }, [modelName]);

  return (
    <main className="container">
      <h1>Live2D Demo</h1>

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
