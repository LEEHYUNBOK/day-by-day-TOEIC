'use client';

import { useState } from 'react';
import Nav from '@/components/Nav';

// 폰 단축어에 넣을 주소는 이 페이지를 어디서 보든 배포 주소여야 한다.
const APP_URL = 'https://day-by-day-toeic.vercel.app';

function CopyUrl() {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(APP_URL);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-gray-100 px-2 py-1 text-sm dark:bg-gray-800">{APP_URL}</code>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          주소 복사
        </button>
      </div>
      {copied === 'done' && <p className="text-sm text-gray-500 dark:text-gray-400">복사했어요.</p>}
      {copied === 'failed' && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          복사가 막혔어요. 위 주소를 직접 선택해서 복사하세요.
        </p>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Platform({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{name}</h3>
      {children}
    </div>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}

export default function SetupPage() {
  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="flex flex-1 flex-col items-center bg-zinc-50 p-4 dark:bg-black">
        <div className="flex w-full max-w-xl flex-col gap-6 py-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">매일 열리게 만들기</h1>
            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              폰 기본 기능만으로 됩니다. 설치가 가장 중요하고, 자동화는 그 다음입니다.
            </p>
          </div>

          <Card title="1. 홈 화면에 설치">
            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              브라우저 북마크가 아니라 앱으로 설치해야 합니다. 아래 주소를 폰에서 열어주세요.
            </p>
            <CopyUrl />
            <Platform name="아이폰">
              <Steps
                items={[
                  <>
                    반드시 <strong className="font-semibold">Safari</strong>로 주소를 엽니다. 다른
                    브라우저로 하면 제대로 설치되지 않습니다.
                  </>,
                  '하단 가운데 공유 버튼(위쪽 화살표)을 누릅니다.',
                  '목록을 내려서 〈홈 화면에 추가〉를 누릅니다.',
                  '이름이 〈토익 단어〉로 보이면 추가를 누릅니다.',
                ]}
              />
            </Platform>
            <Platform name="안드로이드">
              <Steps
                items={[
                  'Chrome으로 주소를 엽니다.',
                  '〈앱 설치〉 배너가 뜨면 그걸 누릅니다. 안 뜨면 오른쪽 위 점 세 개 → 〈앱 설치〉(또는 〈홈 화면에 추가〉)를 누릅니다.',
                  '설치하면 앱 서랍에 일반 앱처럼 들어갑니다.',
                ]}
              />
            </Platform>
            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              제대로 됐는지 확인하는 법: 홈 화면 아이콘으로 열었을 때{' '}
              <strong className="font-semibold">주소창이 안 보이면</strong> 성공입니다. 주소창이
              보이면 그냥 북마크가 된 것이니 다시 해보세요.
            </p>
          </Card>

          <Card title="2. 독에 놓기">
            <p className="text-sm leading-relaxed">
              아이콘을 홈 화면 첫 페이지, 그중에서도 하단 고정줄(독)에 놓으세요. 아이콘을 길게 눌러
              드래그하면 됩니다. 독이 꽉 찼으면 덜 쓰는 앱을 하나 빼세요.
            </p>
            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              습관은 알림보다 눈에 몇 번 걸리느냐로 만들어집니다. 5초 걸리는 이 단계가 아래 자동화보다
              효과가 클 수 있습니다.
            </p>
          </Card>

          <Card title="3. 매일 정해진 시간에 열리게">
            <Platform name="아이폰 — 단축어 자동화">
              <Steps
                items={[
                  '단축어 앱을 열고 하단 〈자동화〉 탭으로 갑니다.',
                  '오른쪽 위 + 를 누르고 〈시간대〉를 고릅니다.',
                  '시간을 정하고 〈매일〉 반복으로 둡니다.',
                  '〈즉시 실행〉을 고릅니다. 버전에 따라 〈실행 전에 묻기〉를 끄는 형태입니다. 이걸 안 하면 매일 확인 알림만 뜨고 앱은 안 열립니다.',
                  '동작으로 〈앱 열기〉를 고르고 토익 단어를 선택합니다.',
                ]}
              />
              <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                홈 화면에 추가한 웹 앱이 〈앱 열기〉 목록에 안 뜰 수 있습니다. iOS 버전에 따라 다릅니다.
                안 보이면 대신 <strong className="font-semibold">〈URL 열기〉</strong> 동작에 위 주소를
                넣으세요. Safari로 열려서 설치된 앱보다는 못하지만 확실히 동작합니다.
              </p>
            </Platform>
            <Platform name="안드로이드">
              <Steps
                items={[
                  '가장 확실한 방법: 시계 앱에서 알람을 만들고 라벨에 〈토익 단어〉를 적습니다. 알람을 끄고 아이콘을 누르면 됩니다.',
                  'Google 어시스턴트 루틴을 쓰면 정해진 시간에 앱을 바로 열 수도 있습니다. 설치된 앱이라 목록에 나옵니다.',
                ]}
              />
            </Platform>
            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              화면에 보이는 문구가 위와 조금 다를 수 있습니다. iOS·Chrome 버전에 따라 메뉴 이름이
              바뀝니다.
            </p>
          </Card>

          <Card title="이미 오늘 다 했으면?">
            <p className="text-sm leading-relaxed">
              자동화는 매일 무조건 앱을 엽니다. 오늘 이미 끝냈으면 앱이 오늘 할 게 없다는 안내와 다음
              복습 날짜를 보여줍니다. 3초면 확인하고 닫을 수 있습니다.
            </p>
          </Card>

          <Card title="아직 안 되는 것">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">홈 화면 위젯</h3>
              <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                아이콘을 누르지 않고 단어가 그냥 떠 있는 것은 웹 앱으로 불가능합니다. 네이티브 앱을
                만들어야 합니다.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">안 했을 때만 오는 알림</h3>
              <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                진도가 이 브라우저에만 저장돼 있어서 서버는 오늘 공부했는지 모릅니다. 조건부 알림은
                로그인과 서버 저장이 먼저입니다.
              </p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
