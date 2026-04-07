import RoadDefectsMap from "../components/map/RoadDefectsMap"
import { Link } from "react-router-dom";

const FOOTER_HEIGHT = 64

const MapPage = () => {
  return (
    <div
      className="flex flex-col bg-black overflow-hidden"
      style={{ height: "100dvh" }}  /* dvh accounts for mobile browser address bar */
    >

      {/* Map */}
      <div
        className="relative"
        style={{ height: `calc(100dvh - ${FOOTER_HEIGHT}px)` }}
      >
        <RoadDefectsMap />
      </div>

      {/* Footer */}
      <footer
        className="bg-black border-t border-purple-500/20 flex items-center justify-center text-center px-4"
        style={{ height: `${FOOTER_HEIGHT}px`, flexShrink: 0 }}
      >
        <p className="text-gray-400 text-sm md:text-base">
          Don't find your place?{" "}
          <Link to="/guide">
            <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent font-medium cursor-pointer hover:opacity-80 transition-opacity">
              Download the hn-Opsin app
            </span>
          </Link>{" "}
          and drive through your area to put it on the map.
        </p>
      </footer>

    </div>
  )
}

export default MapPage