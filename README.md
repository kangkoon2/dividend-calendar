# 배당 캘린더 (US Dividend Calendar)

미국 주요 배당주의 배당락일/지급일을 캘린더로 확인하고, 보유 종목의 배당금을 계산합니다.

## 시작하기

### 1. 설치
```bash
npm install
```

### 2. API 키 설정
[Financial Modeling Prep](https://site.financialmodelingprep.com/register)에서 무료 API 키를 발급받은 뒤:
```bash
cp .env.example .env
```
`.env` 파일에 키 입력:
```
VITE_FMP_API_KEY=발급받은_키
```
> API 키 없이도 기본 내장 데이터(20종목)로 동작합니다.

### 3. 개발 서버
```bash
npm run dev
```

### 4. 빌드
```bash
npm run build
```

## Vercel 배포
1. GitHub에 push
2. [vercel.com](https://vercel.com)에서 레포 연결
3. Environment Variables에 `VITE_FMP_API_KEY` 추가
4. Deploy

## 구조
```
src/
├── App.jsx              # 메인 UI
├── main.jsx             # 엔트리
├── api/dividends.js     # FMP API + 24시간 캐싱
└── data/fallback.js     # 기본 데이터 20종목
```
