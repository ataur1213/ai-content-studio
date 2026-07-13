import { NextRequest, NextResponse } from "next/server";
import { generateVideo } from "@/app/lib/video-service";

export async function POST(
  req: NextRequest
) {

  try {

    const body = await req.json();


    const {
      prompt,
      imageUrl,
      model,
      aspectRatio = "16:9",
      duration = 5,
      negativePrompt = "",
    } = body;



    if (!prompt?.trim()) {

      return NextResponse.json(
        {
          success: false,
          message: "Prompt is required.",
        },
        {
          status: 400,
        }
      );

    }




    const result = await generateVideo({

      prompt,

      imageUrl,

      model,

      aspectRatio,

      duration,

      negativePrompt,

    });





    return NextResponse.json({

      success: true,

      provider: result.provider,

      videoUrl: result.video,

    });




  } catch (error: any) {


    console.error(
      "VIDEO API ERROR:",
      error
    );



    return NextResponse.json(

      {
        success: false,

        message:
          error?.message ||
          "Video generation failed.",
      },

      {
        status: 500,
      }

    );

  }

}