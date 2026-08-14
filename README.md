# 주루마블

Next.js로 만든 술자리 보드게임입니다. 방 데이터는 **Firebase 실시간 DB(무료 Spark)** 에 저장됩니다.

## 시작

```bash
cp .env.example .env.local
npm install
npm run dev
```

처음 한 번은 이 컴퓨터를 켜는 사람만 Firebase 프로젝트를 만들면 됩니다. **같이 하는 사람들은 로그인·가입이 필요 없습니다.**

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 만들기
2. **Build → Realtime Database → 만들기 → 테스트 모드**
3. 톱니바퀴 → 프로젝트 설정 → 내 앱 → 웹 앱 추가
4. `firebaseConfig` 값을 `.env.local`에 넣고 개발 서버 재시작
5. 주소를 공유

같은 와이파이가 아니어도, 주소와 방 코드만 있으면 참가할 수 있습니다.

## 진행

- 한 명이 방 만들기, 나머지는 방 코드로 참가
- 자기 차례일 때만 주사위를 굴림
- 끝나면 다음 턴으로 넘김
