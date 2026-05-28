<<<<<<< HEAD
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## TODO

- 클라이언트 측 WASM 증명 생성
- DB: `proofTxId` 및 `proofExpiresAt` 필드에 issuance/verify에서 값 저장 권장 — 감사와 온체인 연동용.
- 검증 책임: 콘텐츠 백엔드가 raw ZK proof를 재검증하려면 (a) 증명을 포워드하거나 (b) 콘텐츠 백엔드가 `/auth/verify`로 proof를 요청하도록 변경해야 합니다.
- 운영 권장: 클라이언트 측 WASM으로 증명 생성; 서버는 audit/추적용으로 proof 메타만 저장.
=======
# aleo-zpass-demo
>>>>>>> 2489cdd5ec13440f3cbfe27bd0a095dd37e9c565
