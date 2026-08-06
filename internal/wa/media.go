package wa

import (
	"github.com/lugvitc/whats4linux/internal/types"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
)

type MediaContent interface {
	whatsmeow.DownloadableMessage
	GetURL() string
	GetMimetype() string
}

type ExtendedMediaContent interface {
	MediaContent
	GetContextInfo() *waE2E.ContextInfo
}

type Media struct {
	directPath    string
	mediaKey      []byte
	fileSHA256    []byte
	fileEncSHA256 []byte
	url           string
	mimetype      string
	mediaType     types.MediaType
	width, height int
	fileLength    int64
}

func NewMedia(
	directPath string,
	mediaKey, fileSHA256, fileEncSHA256 []byte,
	url, mimetype string,
	width, height int,
	mediaType types.MediaType,

) *Media {
	return &Media{
		directPath:    directPath,
		mediaKey:      mediaKey,
		fileSHA256:    fileSHA256,
		fileEncSHA256: fileEncSHA256,
		url:           url,
		mimetype:      mimetype,
		width:         width,
		height:        height,
		mediaType:     mediaType,
	}
}

func (em *Media) GetMediaType() whatsmeow.MediaType {
	return types.GeneralMediaMap[em.mediaType]
}

func (em *Media) GetMediaGeneralType() types.MediaType {
	return em.mediaType
}

func (em *Media) GetDirectPath() string {
	return em.directPath
}

func (em *Media) GetMediaKey() []byte {
	return em.mediaKey
}

func (em *Media) GetFileSHA256() []byte {
	return em.fileSHA256
}

func (em *Media) GetFileEncSHA256() []byte {
	return em.fileEncSHA256
}

func (em *Media) GetURL() string {
	return em.url
}

func (em *Media) GetMimetype() string {
	return em.mimetype
}

func (em *Media) GetDimensions() (width, height int) {
	return em.width, em.height
}

// SetFileLength stores the decrypted file length reported by WhatsApp (used to
// compute download progress). A value <= 0 means "unknown".
func (em *Media) SetFileLength(fileLength int64) {
	em.fileLength = fileLength
}

// GetFileLength returns the decrypted file length, or -1 when unknown. It
// satisfies whatsmeow's downloadableMessageWithLength interface so that
// DownloadToFile can report progress against a known total.
func (em *Media) GetFileLength() int64 {
	if em.fileLength <= 0 {
		return -1
	}
	return em.fileLength
}
