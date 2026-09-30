// Package erp consume el API del ERP (API/v1/files/helpdesk_*.php en v1.erpsys.pro).
package erp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

var ErrCompanyNotFound = errors.New("empresa no encontrada en el ERP")

type Company struct {
	SeraphID    string `json:"seraph_id"`
	Nombre      string `json:"nombre"`
	RazonSocial string `json:"razon_social"`
	Nit         string `json:"nit"`
	Email       string `json:"email"`
	Telefono    string `json:"telefono"`
	Activa      bool   `json:"activa"`
	Licencia    string `json:"licencia"`
	MaxUsuarios *int   `json:"max_usuarios"`
}

// LicenciaVencida es true si la fecha (YYYY-MM-DD) ya pasó o no se puede leer.
func (c Company) LicenciaVencida() bool {
	d, err := time.Parse("2006-01-02", c.Licencia)
	if err != nil {
		return true
	}
	return time.Now().After(d.AddDate(0, 0, 1))
}

// LimiteUsuarios es el máximo de usuarios de la licencia; 0 si no está definido.
func (c Company) LimiteUsuarios() int {
	if c.MaxUsuarios == nil {
		return 0
	}
	return *c.MaxUsuarios
}

type User struct {
	ID      int    `json:"id"`
	Usuario string `json:"usuario"`
	Nombre  string `json:"nombre"`
	Email   string `json:"email"`
}

type userResponse struct {
	Success bool    `json:"success"`
	Error   string  `json:"error"`
	Exists  bool    `json:"exists"`
	Valid   bool    `json:"valid"`
	Company Company `json:"company"`
	User    *User   `json:"user"`
}

type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

func New(baseURL, token string) *Client {
	return &Client{baseURL: baseURL, token: token, http: &http.Client{Timeout: 15 * time.Second}}
}

func (c *Client) Enabled() bool {
	return c != nil && c.baseURL != "" && c.token != ""
}

// Companies lista las empresas del registro central del ERP.
func (c *Client) Companies(ctx context.Context) ([]Company, error) {
	var out struct {
		Success bool      `json:"success"`
		Error   string    `json:"error"`
		Items   []Company `json:"items"`
	}
	if err := c.do(ctx, http.MethodGet, "/helpdesk_companies.php", nil, &out); err != nil {
		return nil, err
	}
	return out.Items, nil
}

// LookupUser busca un usuario activo por correo en el ERP de la empresa.
func (c *Client) LookupUser(ctx context.Context, seraphID, email string) (*Company, *User, error) {
	var out userResponse
	err := c.do(ctx, http.MethodPost, "/helpdesk_user_lookup.php", map[string]string{"seraph_id": seraphID, "email": email}, &out)
	if err != nil {
		return nil, nil, err
	}
	return &out.Company, out.User, nil
}

// Authenticate valida correo + contraseña del ERP. Devuelve el usuario si son correctos.
func (c *Client) Authenticate(ctx context.Context, seraphID, email, password string) (*User, error) {
	var out userResponse
	err := c.do(ctx, http.MethodPost, "/helpdesk_user_auth.php",
		map[string]string{"seraph_id": seraphID, "email": email, "password": password}, &out)
	if err != nil {
		return nil, err
	}
	if !out.Valid {
		return nil, nil
	}
	return out.User, nil
}

func (c *Client) do(ctx context.Context, method, path string, body any, out any) error {
	if !c.Enabled() {
		return errors.New("integración con el ERP no configurada")
	}
	var raw []byte
	if body != nil {
		var err error
		if raw, err = json.Marshal(body); err != nil {
			return err
		}
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("X-API-Token", c.token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("ERP no disponible: %w", err)
	}
	defer resp.Body.Close()
	var probe struct {
		Error string `json:"error"`
	}
	dec := json.NewDecoder(resp.Body)
	if resp.StatusCode == http.StatusNotFound {
		_ = dec.Decode(&probe)
		if probe.Error == "company_not_found" {
			return ErrCompanyNotFound
		}
	}
	if resp.StatusCode != http.StatusOK {
		_ = dec.Decode(&probe)
		return fmt.Errorf("ERP respondió %d: %s", resp.StatusCode, probe.Error)
	}
	return dec.Decode(out)
}
