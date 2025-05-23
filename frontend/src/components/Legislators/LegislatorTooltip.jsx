import { BiData } from "react-icons/bi";
import "../../index.css";

export const Tooltip = ({ xPos, yPos, name }) => {
  console.log(xPos, yPos, name)
  if (!xPos || !yPos || !name) {
    console.log("returned null")
    return null;
  }

  return (
    <div
      className="tooltip"
      style={{
        position: "absolute",
        left: xPos,
        top: yPos,
        pointerEvents: "auto",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        borderRadius: "4px",
        color: "white",
        fontSize: "12px",
        padding: "5px",
      }}
    >
      {name.text}
    </div>
  );
};

export const TooltipGroup = ({ xPos, yPos, data, setLegislatorClicked }) => {
  if (!xPos || !yPos || !data || data.length === 0) {
    return null;
    }

   

    const handleClick = (data) => {
        setLegislatorClicked(data[0][0])
  }
  
  // useEffect(() => {
  //     console.log("leg data")
  //   })
    

  return (
    <div
      className="tooltip"
      style={{
        position: "absolute",
        left: xPos,
        top: yPos,
        pointerEvents: "auto", // make sure the tooltip is interactive
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        borderRadius: "4px",
        fontSize: "12px",
        padding: "5px",
        maxHeight: "150px",
        overflowY: "auto",
        width: "200px",
      }}
    >
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {data.map((data, index) => (
          <li className={data.party === "D" ? "text-blue-400 " : "text-red-400" } key={index} style={{ marginBottom: "4px" }} >
            <button onClick={()=> handleClick(data)} >
                    {data.name + " " + "(" + data.party + ")"}
                    </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const TextTip = ({ xPos, yPos, postText }) => {

  console.log("TextTip Data", xPos, yPos, postText)

  

  return (
    <div className="tooltip"
      style={{
        position: "absolute",
        left: xPos,
        top: yPos,
        pointerEvents: "auto",
        backgroundColor: "rgba(0,0,0,0.8)",
        borderRadius: "4px",
        fontSize: "12px",
        padding: "5px",
        maxHeight: "500px",
        overflowY: "auto",
        width: "200px"
          }}>
      this is a text tip
    </div>
  )
}
