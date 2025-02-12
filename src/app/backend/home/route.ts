import { NextResponse } from "next/server";

export async function GET(){
    return NextResponse.json('home api route discovered. good.', {status: 200})
}