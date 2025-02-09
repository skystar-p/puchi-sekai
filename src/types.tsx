export interface ILive2DModelData {
  Version: number;
  FileReferences: {
    Moc: string;
    Textures: string[];
    Physics: string;
    Motions: {
      Motion: {
        Name: string;
        File: string;
        FadeInTime: number;
        FadeOutTime: number;
      }[];
      Expression: {
        Name: string;
        File: string;
        FadeInTime: number;
        FadeOutTime: number;
      }[];
    };
    Expressions: Record<string, never>;
  };
  Groups: {
    Target: string;
    Name: string;
    Ids: number[];
  }[];
  url: string;
}
