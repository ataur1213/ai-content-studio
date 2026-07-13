import { fal } from "@fal-ai/client";


// =====================================================
// Types
// =====================================================

export interface VideoOptions {

  prompt: string;

  imageUrl?: string;

  model?: string;

  aspectRatio?: string;

  duration?: 5 | 10;

  negativePrompt?: string;

}



export interface VideoResult {

  provider: string;

  video: string;

}



// =====================================================
// FAL Config
// =====================================================

fal.config({
  credentials: process.env.FAL_VIDEO_API_KEY,
});
console.log(
  "FAL KEY FOUND:",
  Boolean(process.env.FAL_KEY)
);



// =====================================================
// Helpers
// =====================================================


function getAspectRatio(
  ratio?: string
) {

  return ratio || "16:9";

}



function getDuration(
  duration?: 5 | 10
): 5 | 10 {

  return duration === 10
    ? 10
    : 5;

}



function getDefaultModel(
  model?: string
) {

  return (

    model ||

    "fal-ai/kling-video/v2/master/image-to-video"

  );

}





// =====================================================
// FAL AI Provider
// =====================================================


async function generateWithFal(
  options: VideoOptions
): Promise<VideoResult> {


  if(
    !process.env.FAL_KEY
  ){

    throw new Error(
      "FAL_KEY not found"
    );

  }



  console.log(
    "Using FAL AI..."
  );



  const result =
    await fal.subscribe(

      getDefaultModel(
        options.model
      ),


      {


        input:{


          prompt:
            options.prompt,


          image_url:
            options.imageUrl,


          aspect_ratio:
            getAspectRatio(
              options.aspectRatio
            ),


          duration:
            getDuration(
              options.duration
            ),


          negative_prompt:
            options.negativePrompt || "",


        },


        logs:true,


        onQueueUpdate(update){


          if(
            update.status ===
            "IN_PROGRESS"
          ){


            update.logs
            ?.forEach(
              (log)=>
              console.log(
                log.message
              )
            );


          }


        },


      }


    );




  const data:any =
    result.data;




  const video =

    data?.video?.url ||

    data?.video_url ||

    data?.url ||

    "";




  if(!video){


    throw new Error(
      "FAL video URL not found"
    );


  }




  return {


    provider:
      "FAL AI",


    video,


  };


}

// =====================================================
// Replicate AI Provider
// =====================================================


async function generateWithReplicate(
  options: VideoOptions
): Promise<VideoResult> {


  if(
    !process.env.REPLICATE_API_TOKEN
  ){

    throw new Error(
      "REPLICATE_API_TOKEN not found"
    );

  }



  console.log(
    "Using Replicate AI..."
  );



  const response =
    await fetch(

      "https://api.replicate.com/v1/predictions",

      {

        method:
          "POST",


        headers:{


          "Authorization":
          `Token ${process.env.REPLICATE_API_TOKEN}`,


          "Content-Type":
          "application/json",


        },


        body:
        JSON.stringify({

          version:
          options.model || "",


          input:{


            prompt:
              options.prompt,


            image:
              options.imageUrl,


            aspect_ratio:
              options.aspectRatio || "16:9",


          },


        }),


      }


    );



  if(
    !response.ok
  ){

    throw new Error(
      "Replicate generation failed"
    );

  }



  const data:any =
    await response.json();



  const video =

    data?.output?.[0] ||

    data?.output ||

    "";



  if(!video){

    throw new Error(
      "Replicate video URL missing"
    );

  }



  return {

    provider:
      "Replicate AI",


    video,


  };


}








// =====================================================
// Runway AI Provider
// =====================================================


async function generateWithRunway(
  options: VideoOptions
): Promise<VideoResult> {



  if(
    !process.env.RUNWAY_API_KEY
  ){

    throw new Error(
      "RUNWAY_API_KEY not found"
    );

  }



  console.log(
    "Using Runway AI..."
  );




  const response =
    await fetch(

      "https://api.runwayml.com/v1/image_to_video",

      {


        method:
          "POST",


        headers:{


          "Authorization":
          `Bearer ${process.env.RUNWAY_API_KEY}`,


          "Content-Type":
          "application/json",


        },


        body:
        JSON.stringify({

          prompt:
            options.prompt,


          image_url:
            options.imageUrl,


        }),


      }


    );





  if(
    !response.ok
  ){

    throw new Error(
      "Runway generation failed"
    );

  }





  const data:any =
    await response.json();




  const video =

    data?.output?.[0] ||

    data?.video ||

    "";





  if(!video){


    throw new Error(
      "Runway video URL missing"
    );


  }





  return {


    provider:
      "Runway AI",


    video,


  };


}








// =====================================================
// Stability AI Provider
// =====================================================


async function generateWithStability(
  options: VideoOptions
): Promise<VideoResult> {



  if(
    !process.env.STABILITY_API_KEY
  ){

    throw new Error(
      "STABILITY_API_KEY not found"
    );

  }



  console.log(
    "Using Stability AI..."
  );




  const response =
    await fetch(

      "https://api.stability.ai/v2beta/image-to-video",

      {


        method:
          "POST",


        headers:{


          "Authorization":
          `Bearer ${process.env.STABILITY_API_KEY}`,


          "Content-Type":
          "application/json",


        },


        body:
        JSON.stringify({

          prompt:
            options.prompt,


          image_url:
            options.imageUrl,


        }),


      }


    );





  if(
    !response.ok
  ){

    throw new Error(
      "Stability generation failed"
    );

  }





  const data:any =
    await response.json();




  const video =

    data?.video ||

    data?.url ||

    "";





  if(!video){


    throw new Error(
      "Stability video URL missing"
    );


  }





  return {


    provider:
      "Stability AI",


    video,


  };


}

// =====================================================
// Provider Priority List
// =====================================================
// যেটা আগে থাকবে সেটাই আগে চেষ্টা করবে


const providers = [

  generateWithFal,

  generateWithReplicate,

  generateWithRunway,

  generateWithStability,

];






// =====================================================
// Main Video Generator
// =====================================================


export async function generateVideo(
  options: VideoOptions
): Promise<VideoResult> {



  if(
    !options.prompt ||
    !options.prompt.trim()
  ){

    throw new Error(
      "Prompt is required"
    );

  }





  let lastError:any;




  for(
    const provider of providers
  ){


    try {



      const result =
        await provider(
          options
        );



      console.log(

        "SUCCESS:",

        result.provider

      );



      return result;



    } catch(error:any){



      console.error(

        "Provider failed:",

        error.message

      );



      lastError =
        error;



    }


  }





  throw new Error(

    lastError?.message ||

    "All video providers failed"

  );



}








// =====================================================
// Provider Status
// =====================================================


export function providerStatus(){


  return {


    FAL_AI:

      Boolean(
        process.env.FAL_KEY
      ),



    REPLICATE:

      Boolean(
        process.env.REPLICATE_API_TOKEN
      ),



    RUNWAY:

      Boolean(
        process.env.RUNWAY_API_KEY
      ),



    STABILITY:

      Boolean(
        process.env.STABILITY_API_KEY
      ),


  };


}








// =====================================================
// Supported Video Models
// =====================================================


export function supportedVideoModels(){


  return [


    {


      id:

      "fal-ai/kling-video/v2/master/image-to-video",


      name:

      "Kling V2 Image To Video",


    },



    {


      id:

      "fal-ai/kling-video/o3/pro/video-to-video/edit",


      name:

      "Kling O3 Video Edit",


    },


  ];


}