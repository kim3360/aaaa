import { Suspense } from "react"
import GameApp from "@/components/GameApp"

export default function Page() {
  return (
    <Suspense>
      <GameApp />
    </Suspense>
  )
}
