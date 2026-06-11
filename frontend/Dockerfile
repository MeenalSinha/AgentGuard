FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_cHJlY2lvdXMtcGlnZW9uLTgyLmNsZXJrLmFjY291bnRzLmRldiQ
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
ENV NEXT_PUBLIC_API_URL=https://agentguard-api-twgytbijtq-uc.a.run.app
ENV NEXT_PUBLIC_APP_URL=https://agentguard-frontend-twgytbijtq-uc.a.run.app
RUN npm run build
EXPOSE 8080
ENV PORT=8080
CMD ["npm", "start"]
