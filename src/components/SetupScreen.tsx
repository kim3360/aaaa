export default function SetupScreen() {
  return (
    <section className="screen">
      <div className="setup-head">
        <h1 className="title">한 번만 연결</h1>
      </div>
      <p className="sub-copy" style={{ textAlign: 'left' }}>
        Firebase 로그인은 <b>이 컴퓨터를 켜는 사람만</b> 하면 됩니다. 술자리에 오는 사람들은 가입도 로그인도 필요 없습니다.
      </p>
      <ol className="setup-steps">
        <li>
          <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer">Firebase 콘솔</a>
          에서 프로젝트 1개 만들기
        </li>
        <li>Build → Realtime Database → 만들기 → 테스트 모드</li>
        <li>톱니바퀴 → 프로젝트 설정 → 내 앱 → 웹 앱 추가</li>
        <li>
          <code>.env.example</code>을 복사해 <code>.env.local</code>을 만들고 firebaseConfig 값을 넣기
        </li>
        <li>개발 서버를 재시작한 뒤 이 페이지를 새로고침</li>
      </ol>
      <p className="sub-copy" style={{ textAlign: 'left' }}>
        설정이 들어가면 다른 사람은 주소만 열고 이름 적은 다음 방에 들어오면 됩니다.
      </p>
      <button className="btn btn-gold" onClick={() => location.reload()}>서버 재시작 후 새로고침</button>
    </section>
  );
}
