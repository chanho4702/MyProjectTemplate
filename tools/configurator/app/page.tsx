import type { Metadata } from "next";
import { Configurator } from "./Configurator";

export const metadata: Metadata = {
  title: "MSA Architecture Console",
  description: "필요한 기능만 골라 실행 가능한 MSA 템플릿 설정을 만듭니다.",
};

export default function Home() {
  return <Configurator />;
}
