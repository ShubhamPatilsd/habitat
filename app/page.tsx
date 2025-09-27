import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen p-20">
      <div className="max-w-[600px]">
        <h1 className="text-[9rem] leading-none m-0">Habitat</h1>
        <p className="text-xl mt-4 ml-2">
          It's a place where curiosity is nurtured,
          <br />
          where you can explore new ideas, and
          <br />
          rediscover the joy of discovery.
        </p>
        <Link href="/nodes">
          <button className="hover:bg-[#1e00ff] hover:text-[#fff0d2] transition ml-2 mt-16 p-4 border-[#1e00ff] border-[1.5px] w-[60%] text-lg font-medium">
            Take Me
          </button>
        </Link>
        <div className="w-2 mt-0 ml-[20%] h-screen bg-gradient-to-b from-[#fff0d2] via-[#1e00ff] to-[#1e00ff]"></div>
      </div>
    </div>
  );
}
