export default function StatusBar() {
    return (
      <div className="status-bar">
        <strong>9:41</strong>
        <div className="status-icons">
          <span className="signal">▮▮▮</span>
          <span>⌁</span>
          <span className="battery" />
        </div>
      </div>
    )
  }