import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px 20px" }}>
      <SignUp />
    </div>
  );
}
