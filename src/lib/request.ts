import { cookies } from "next/headers";
import { sessionCookieName, unsealSession } from "./session";

export async function getSession() { return unsealSession((await cookies()).get(sessionCookieName)?.value); }
export async function sessionToken() { return (await getSession())?.token ?? null; }
export async function sessionClientId() { return (await getSession())?.clientId ?? null; }
